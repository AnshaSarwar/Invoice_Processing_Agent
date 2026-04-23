"""Command Line Interface for InvoSync invoice processing."""
import click
import asyncio
import time
import os
import sys
from pathlib import Path
from app.db.session import DatabaseManager, ProcessingMonitor
from app.agents.graph import invoice_matching_app
from app.core.config import settings

@click.group()
def cli():
    """InvoSync CLI: Process invoices from the terminal."""
    pass

@cli.command()
@click.option('--file', type=click.Path(exists=True), required=True, help="Path to the invoice PDF.")
@click.option('--user-id', type=int, default=1, help="ID of the operator running the process.")
def process(file: str, user_id: int):
    """Processes a single invoice file and matching it against PO data."""
    click.echo(f"Processing invoice: {file}")
    
    # Initialize services
    db = DatabaseManager()
    monitor = ProcessingMonitor(db)
    
    async def run_pipeline():
        start_time = time.time()
        state = {
            "invoice_data": {},
            "po_data": {},
            "comparison_result": {},
            "status": "pending",
            "filepath": str(file),
            "error_message": "",
            "raw_text": "",
            "requires_human_review": False
        }
        
        # Execute agent graph
        result = await invoice_matching_app.ainvoke(
            state, 
            config={"configurable": {"thread_id": f"cli_{int(time.time() * 1000)}"}}
        )
        
        # Log results
        monitor.log_processing(str(file), result, time.time() - start_time, owner_id=user_id)
        
        click.echo("-" * 30)
        click.echo(f"Status: {result.get('status')}")
        if result.get('status') == 'completed':
            click.echo(f"Matched PO: {result['invoice_data']['po_number']}")
            click.echo(f"Confidence: {result['invoice_data']['confidence_score']}")
        else:
             click.echo(f"Error: {result.get('error_message')}")
        click.echo("-" * 30)

    asyncio.run(run_pipeline())

if __name__ == "__main__":
    cli()
