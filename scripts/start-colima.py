from __future__ import annotations

import os
import platform
import subprocess
import sys
from typing import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    # platform.processor() changed at some point between these:
    # 11.2.3: arm
    # 12.3.1: arm64
    APPLE_ARM64 = sys.platform == "darwin" and platform.processor() in {"arm", "arm64"}

    cpus = os.cpu_count()
    if cpus is None:
        raise SystemExit("failed to determine cpu count")

    # SC_PAGE_SIZE is POSIX 2008
    # SC_PHYS_PAGES is a linux addition but also supported by more recent MacOS versions
    SC_PAGE_SIZE = os.sysconf("SC_PAGE_SIZE")
    SC_PHYS_PAGES = os.sysconf("SC_PHYS_PAGES")
    if SC_PAGE_SIZE == -1 or SC_PHYS_PAGES == -1:
        raise SystemExit("failed to determine memsize_bytes")
    memsize_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")

    args = [
        "--cpu",
        f"{cpus//2}",
        "--memory",
        f"{memsize_bytes//(2*1024**3)}",
    ]
    if APPLE_ARM64:
        args = [*args, "--vm-type=vz", "--vz-rosetta", "--mount-type=virtiofs"]
    HOME = os.path.expanduser("~")
    rc = subprocess.call(
        (
            f"{HOME}/.local/share/sentry-devenv/bin/colima",
            "start",
            f"--mount=/var/folders:w,/private/tmp/colima:w,{HOME}:r",
            *args,
        )
    )
    if rc != 0:
        return rc
    return subprocess.call(("docker", "context", "use", "colima"))


if __name__ == "__main__":
    raise SystemExit(main())
