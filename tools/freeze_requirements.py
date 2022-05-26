from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from os.path import abspath
from subprocess import CalledProcessError, run

from tools.lib import gitroot


def main() -> int:
    base_path = abspath(gitroot())
    base_cmd = (
        "pip-compile",
        "--no-header",
        "--no-annotate",
        "--allow-unsafe",
        "-q",
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = (
            # executor.submit(
            #    run,
            #    (
            #        *base_cmd,
            #        f"{base_path}/requirements-base.txt",
            #        "-o",
            #        f"{base_path}/requirements-frozen.txt",
            #    ),
            #    check=True,
            #    capture_output=True,
            # ),
            executor.submit(
                run,
                (
                    *base_cmd,
                    f"{base_path}/requirements-dev.txt",
                    "-o",
                    f"{base_path}/requirements-dev-only-frozen.txt",
                ),
                check=True,
                capture_output=True,
            ),
            # executor.submit(
            #    run,
            #    (
            #        *base_cmd,
            #        f"{base_path}/requirements-base.txt",
            #        f"{base_path}/requirements-dev.txt",
            #        "-o",
            #        f"{base_path}/requirements-dev-frozen.txt",
            #    ),
            #    check=True,
            #    capture_output=True,
            # ),
        )

    rc = 0
    for future in futures:
        try:
            proc = future.result()
        except CalledProcessError as e:
            rc = 1
            print(
                f"""`{e.cmd}` returned code {e.returncode}

stdout:
{e.stdout.decode()}

stderr:
{e.stderr.decode()}
"""
            )
        except Exception as e:
            rc = 1
            print(f"exception occured while running `{proc.args}`:\n{e}")

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
