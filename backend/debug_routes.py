from app.main import app

def print_routes():
    print(f"{'METHOD':<10} | {'PATH':<40} | {'NAME'}")
    print("-" * 65)
    for route in app.routes:
        methods = getattr(route, "methods", ["ANY"])
        for method in methods:
            print(f"{method:<10} | {route.path:<40} | {route.name}")

if __name__ == "__main__":
    print_routes()
