from __future__ import annotations

import os
import platform
import subprocess
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    if not os.getenv("CI"):
        macos_version = platform.mac_ver()[0]
        macos_major_version = int(macos_version.split(".")[0])
        if macos_major_version < 14:
            raise SystemExit(f"macos >= 14 is required to use colima, found {macos_version}")

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
    if platform.machine() == "arm64":
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
