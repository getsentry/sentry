#!/usr/bin/env python3
"""Write the pull request context that frontend-snapshots-upload.yml needs.

The upload workflow runs on workflow_run, which carries no pull request
context, so frontend-snapshots.yml writes it to $VCS_METADATA_FILE as JSON:
pr_number, base_ref, and base_sha, each a string, empty when unknown. The
file is printed after it is written.
"""

from __future__ import annotations

import json
import os
from pathlib import Path


def main() -> None:
    path = Path(os.environ["VCS_METADATA_FILE"])
    metadata = {
        "pr_number": os.environ.get("PR_NUMBER", ""),
        "base_ref": os.environ.get("BASE_REF", ""),
        "base_sha": os.environ.get("BASE_SHA", ""),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(path.read_text(encoding="utf-8"), end="")


if __name__ == "__main__":
    main()
