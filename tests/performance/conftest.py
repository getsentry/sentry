import sys
from pathlib import Path

# Keep development tooling importable only within this test subtree.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bin/perf"))
