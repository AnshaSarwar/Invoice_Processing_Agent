import socket

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

ports_to_check = [8000, 8001, 5000, 8080]
print("Checking common backend ports...")
for p in ports_to_check:
    status = "OPEN" if check_port(p) else "CLOSED"
    print(f"Port {p}: {status}")
