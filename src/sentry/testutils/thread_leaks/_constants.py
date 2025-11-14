from typing import int
"""Shared constants for thread leak detection."""

import os
from pathlib import Path

# Current working directory with trailing slash for path replacement
CWD = os.getcwd() + "/"

# Thread leaks package directory (normalized to relative path like "./src/...")
HERE = str(Path(__file__).parent) + "/"
HERE = HERE.replace(CWD, "./")
