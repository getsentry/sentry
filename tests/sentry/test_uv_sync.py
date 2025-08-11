from __future__ import annotations

import subprocess


def test_uv_lock_in_sync() -> None:
    reqs = set()
    with open("requirements-dev-frozen.txt") as f:
        for line in f.readlines():
            line = line.strip()
            if not line or line.startswith(("--", "#")):
                continue
            reqs.add(line)

    out = subprocess.check_output(
        ("uv", "export", "--no-hashes", "--no-annotate", "--no-header"),
    )

    uv_reqs = set()

    for line in out.decode().splitlines():
        spec = line.split(" ")[0]
        uv_reqs.add(spec)

    diff = uv_reqs - reqs
    assert diff == set(), f"uv_reqs - reqs: {diff}"
