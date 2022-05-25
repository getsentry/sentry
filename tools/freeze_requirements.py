import os
from concurrent.futures import ThreadPoolExecutor
from subprocess import run
from typing import Tuple

from tools.lib import gitroot
from tools.lib import ts_print as print


def worker(cmd: Tuple[str, ...]) -> Tuple[str, int]:
    cmd_pretty = " ".join(cmd)
    print(f"+ {cmd_pretty}")
    proc = run(cmd, capture_output=True)
    rc = proc.returncode
    print(f"+ {cmd_pretty} returned {rc}")
    if rc != 0:
        print(f"stdout: {proc.stdout.decode()}\nstderr: {proc.stderr.decode()}")
    return cmd_pretty, rc


def main() -> int:
    os.chdir(gitroot())

    base_cmd = (
        "pip-compile",
        "--no-header",
        "--no-annotate",
        "--allow-unsafe",
        "-q",
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = (
            #            executor.submit(
            #                worker,
            #                (
            #                    *base_cmd,
            #                    "requirements-base.txt",
            #                    "-o",
            #                    "requirements-frozen.txt",
            #                ),
            #            ),
            executor.submit(
                worker,
                (
                    *base_cmd,
                    "requirements-dev.txt",
                    "-o",
                    "requirements-dev-only-frozen.txt",
                ),
            ),
            #            executor.submit(
            #                worker,
            #                (
            #                    *base_cmd,
            #                    "requirements-base.txt",
            #                    "requirements-dev.txt",
            #                    "-o",
            #                    "requirements-dev-frozen.txt",
            #                ),
            #            ),
        )

    rc = 0
    for future in futures:
        try:
            cmd_pretty, rc = future.result()
        except Exception as e:
            print(f"exception occured while running `{cmd_pretty}`:\n{e}")

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
