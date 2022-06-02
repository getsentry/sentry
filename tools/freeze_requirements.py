from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from os.path import abspath
from subprocess import CalledProcessError, run

from tools.lib import gitroot

# This is temporary until tools/ is moved to distributable devenvs.
GETSENTRY = os.environ.get("GETSENTRY_FREEZE_REQUIREMENTS")


def worker(args: tuple[str, ...]) -> None:
    # pip-compile doesn't let you customize the header, so we write
    # one ourselves. However, pip-compile needs -o DEST otherwise
    # it will bump >= pins even if they're satisfied. So, we need to
    # unfortunately rewrite the whole file.
    dest = args[-1]
    try:
        run(args, check=True, capture_output=True)
    except CalledProcessError as e:
        raise e

    with open(dest, "rb+") as f:
        content = f.read()
        f.seek(0, 0)
        f.write(
            b"""# DO NOT MODIFY. This file was generated with `make freeze-requirements`.

"""
            + content
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

    with ThreadPoolExecutor(max_workers=3) as executor:
        if GETSENTRY:
            futures = (
                executor.submit(
                    worker,
                    (
                        *base_cmd,
                        f"{base_path}/requirements-base.txt",
                        f"{base_path}/../sentry/requirements-base.txt",
                        "-o",
                        f"{base_path}/requirements-frozen.txt",
                    ),
                ),
                executor.submit(
                    worker,
                    (
                        *base_cmd,
                        f"{base_path}/requirements-base.txt",
                        f"{base_path}/../sentry/requirements-base.txt",
                        f"{base_path}/requirements-dev.txt",
                        f"{base_path}/../sentry/requirements-dev.txt",
                        "-o",
                        f"{base_path}/requirements-dev-frozen.txt",
                    ),
                ),
            )
        else:
            futures = (
                executor.submit(
                    worker,
                    (
                        *base_cmd,
                        f"{base_path}/requirements-base.txt",
                        "-o",
                        f"{base_path}/requirements-frozen.txt",
                    ),
                ),
                executor.submit(
                    worker,
                    (
                        *base_cmd,
                        f"{base_path}/requirements-base.txt",
                        f"{base_path}/requirements-dev.txt",
                        "-o",
                        f"{base_path}/requirements-dev-frozen.txt",
                    ),
                ),
                # requirements-dev-only-frozen.txt is only used in sentry as a
                # fast path for some CI jobs.
                executor.submit(
                    worker,
                    (
                        *base_cmd,
                        f"{base_path}/requirements-dev.txt",
                        "-o",
                        f"{base_path}/requirements-dev-only-frozen.txt",
                    ),
                ),
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
