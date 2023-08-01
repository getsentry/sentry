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

    cpus = int(subprocess.run(("sysctl", "-n", "hw.ncpu"), check=True, capture_output=True).stdout)
    memsize_bytes = int(
        subprocess.run(("sysctl", "-n", "hw.memsize"), check=True, capture_output=True).stdout
    )
    args = [
        "--cpu",
        f"{cpus//2}",
        "--memory",
        f"{memsize_bytes//(2*1024**3)}",
    ]
    if APPLE_ARM64:
        args = [*args, "--vm-type=vz", "--vz-rosetta", "--mount-type=virtiofs"]
    return subprocess.call(
        (
            "colima",
            "start",
            f"--mount=/var/folders:w,/private/tmp/colima:w,{os.path.expanduser('~')}:r",
            *args,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
