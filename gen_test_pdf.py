from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

def create_invoice(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # Header
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 50, "TECH SOLUTIONS INC.")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 70, "123 Innovation Drive, Silicon Valley, CA")
    c.drawString(50, height - 85, "Email: billing@techsolutions.com")

    # Invoice Info
    c.setFont("Helvetica-Bold", 14)
    c.drawString(400, height - 50, "INVOICE")
    
    c.setFont("Helvetica", 10)
    c.drawString(400, height - 70, "Invoice #: INV-99001")
    c.drawString(400, height - 85, "Date: 2026-04-14")
    
    # CRITICAL MATCHING FIELD
    c.setFont("Helvetica-Bold", 12)
    c.drawString(400, height - 110, "PO Number: PO_234")

    # Table Header
    c.line(50, height - 130, 550, height - 130)
    c.drawString(50, height - 145, "Description")
    c.drawString(350, height - 145, "Quantity")
    c.drawString(450, height - 145, "Unit Price")
    c.drawString(520, height - 145, "Total")
    c.line(50, height - 150, 550, height - 150)

    # Line Item (Matching DB amount)
    c.drawString(50, height - 170, "Enterprise Software License - Annual")
    c.drawString(350, height - 170, "1")
    c.drawString(450, height - 170, "1000.00")
    c.drawString(520, height - 170, "1000.00")

    # Totals
    c.line(400, height - 200, 550, height - 200)
    c.drawString(400, height - 215, "Tax (0%):")
    c.drawString(520, height - 215, "0.00")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(400, height - 235, "TOTAL AMOUNT:")
    c.drawString(520, height - 235, "$1000.00")

    c.save()
    print(f"Test Invoice created: {filename}")

if __name__ == "__main__":
    create_invoice("test_invoice.pdf")
