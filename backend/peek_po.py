from app.db.session import DatabaseManager
from app.db.models import PurchaseOrder
import json

def peek():
    db = DatabaseManager()
    with db.get_session() as sess:
        pos = sess.query(PurchaseOrder).all()
        if not pos:
            print("NO_PO_FOUND — database is empty.")
            return
        for po in pos:
            print(json.dumps(po.to_dict(), indent=2))

if __name__ == "__main__":
    peek()
