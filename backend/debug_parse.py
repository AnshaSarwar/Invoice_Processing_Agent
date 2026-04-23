import asyncio
import os
import json
from app.agents.tools import parse_invoice
from app.core.config import settings

async def debug_parse():
    # Find the test invoice
    filepath = "test_invoice.pdf"
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    print(f"Testing parse for {filepath}...")
    result = await parse_invoice.ainvoke({"filepath": filepath})
    print("\n--- RESULT ---")
    print(result)
    
    data = json.loads(result)
    print("\n--- PARSED DATA ---")
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(debug_parse())
