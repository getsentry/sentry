#!/usr/bin/env python3

import requests

url = "https://raw.githubusercontent.com/getsentry/arroyo/main/arroyo/processing/processor.py"
response = requests.get(url)

if response.status_code == 200:
    with open("/tmp/arroyo_processor.py", "w") as f:
        f.write(response.text)
    print("File fetched successfully")
else:
    print(f"Failed to fetch file: {response.status_code}")
