import requests
import json
import time
import os
import sseclient

BASE_URL = "http://localhost:8000"
TEST_USER = {
    "username": f"test_op_{int(time.time())}",
    "password": "Password123!",
    "full_name": "Test Operator",
    "role": "Operator"
}

def run_test():
    print(f"--- STARTING E2E TEST AT {BASE_URL} ---")
    
    # 1. Signup
    print(f"Step 1: Signing up {TEST_USER['username']}...")
    resp = requests.post(f"{BASE_URL}/api/v1/auth/signup", json=TEST_USER)
    if resp.status_code != 200:
        print(f"FAILED Signup: {resp.text}")
        return
    print("SUCCESS")

    # 2. Login
    print("Step 2: Logging in...")
    resp = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "username": TEST_USER["username"],
        "password": TEST_USER["password"]
    })
    if resp.status_code != 200:
        print(f"FAILED Login: {resp.text}")
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("SUCCESS (Token received)")

    # 3. Upload
    print("Step 3: Uploading test_invoice.pdf...")
    with open("test_invoice.pdf", "rb") as f:
        resp = requests.post(
            f"{BASE_URL}/api/v1/invoices/upload", 
            headers=headers,
            files={"file": ("test_invoice.pdf", f, "application/pdf")}
        )
    if resp.status_code != 200:
        print(f"FAILED Upload: {resp.text}")
        return
    task_id = resp.json()["task_id"]
    print(f"SUCCESS (Task ID: {task_id})")

    # 4. Stream Analysis (SSE)
    print("Step 4: Streaming AI Analysis...")
    url = f"{BASE_URL}/api/v1/invoices/stream/{task_id}"
    # Use Bearer token for authorized SSE
    params = {"token": token} 
    
    stream_resp = requests.get(url, params=params, stream=True, headers=headers)
    
    completed = False
    for line in stream_resp.iter_lines():
        if line:
            decoded_line = line.decode('utf-8')
            if decoded_line.startswith('data: '):
                try:
                    data = json.loads(decoded_line[6:])
                    node = data.get("node", "???")
                    status = data.get("status", "???")
                    message = data.get("message", "")
                    print(f"  [AI] Node: {node:10} | Status: {status} | {message}")
                    
                    if status == "completed":
                        completed = True
                        break
                    if status == "failed":
                        print(f"  [ERROR] AI Failure: {data.get('error') or data.get('message')}")
                        break
                except json.JSONDecodeError:
                    continue

    if completed:
        print("SUCCESS: Pipeline reached 'completed' state.")
    else:
        print("FAILED: Pipeline did not finish correctly.")

    # 5. Verify Cleanup
    print("Step 5: Verifying file cleanup...")
    time.sleep(1) # Give a moment for OS to release file handle
    temp_files = os.listdir("invoices_temp")
    if not any(task_id in f for f in temp_files):
        print("SUCCESS: File was successfully deleted from invoices_temp.")
    else:
        print(f"FAILED: File still exists on server: {temp_files}")

    print("--- E2E TEST FINISHED ---")

if __name__ == "__main__":
    run_test()
