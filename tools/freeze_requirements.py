from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from os.path import abspath
from subprocess import CalledProcessError, run

from tools.lib import gitroot


def worker(args: tuple[str, ...]) -> None:
    # pip-compile doesn't let you customize the header, so we write
    # one ourselves.
    assert args[-2] == "-o-"
    dest = args[-1]
    try:
        proc = run(args[:-1], check=True, capture_output=True)
    except CalledProcessError as e:
        raise e

    with open(dest, "wb") as f:
        f.write(
            b"""# DO NOT MODIFY. This file was generated with `make freeze-requirements`.

"""
            + proc.stdout
        )


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
            #    worker,
            #    (
            #        *base_cmd,
            #        f"{base_path}/requirements-base.txt",
            #        "-o-",
            #        f"{base_path}/requirements-frozen.txt",
            #    ),
            # ),
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-dev.txt",
                    "-o-",
                    f"{base_path}/requirements-dev-only-frozen.txt",
                ),
            ),
            # executor.submit(
            #    worker,
            #    (
            #        *base_cmd,
            #        f"{base_path}/requirements-base.txt",
            #        f"{base_path}/requirements-dev.txt",
            #        "-o-",
            #        f"{base_path}/requirements-dev-frozen.txt",
            #    ),
            # ),
        )

    rc = 0
    for future in futures:
        try:
            future.result()
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

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
