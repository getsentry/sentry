from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from os.path import abspath
from shutil import copyfile
from subprocess import CalledProcessError, run
from typing import Any, Optional

from tools.lib import gitroot


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


# XXX(typing): it's supposed to be list[Future]
def check_futures(futures: list[Any]) -> int:
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


def main(repo: str, outdir: Optional[str] = None) -> int:
    base_path = abspath(gitroot())

    if outdir is None:
        outdir = base_path
    else:
        # We rely on pip-compile's behavior when -o FILE is
        # already a lockfile, due to >= pins.
        # So if we have a different outdir (used by things like
        # tools.lint_requirements), we'll need to copy over existing
        # lockfiles.
        lockfiles = [
            "requirements-frozen.txt",
            "requirements-dev-frozen.txt",
        ]
        if repo == "sentry":
            lockfiles.append("requirements-dev-only-frozen.txt")
        for fn in lockfiles:
            copyfile(f"{base_path}/{fn}", f"{outdir}/{fn}")

    base_cmd = (
        "pip-compile",
        "--no-header",
        "--no-annotate",
        "--allow-unsafe",
        "-q",
    )

    executor = ThreadPoolExecutor(max_workers=3)
    futures = []

    if repo != "getsentry":
        futures.append(
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-base.txt",
                    "-o",
                    f"{outdir}/requirements-frozen.txt",
                ),
            )
        )
        futures.append(
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-base.txt",
                    f"{base_path}/requirements-dev.txt",
                    "-o",
                    f"{outdir}/requirements-dev-frozen.txt",
                ),
            )
        )
    else:
        futures.append(
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-base.txt",
                    # This is downloaded with bin/bump-sentry.
                    f"{base_path}/sentry-requirements-frozen.txt",
                    "-o",
                    f"{outdir}/requirements-frozen.txt",
                ),
            )
        )
        # getsentry shares sentry's requirements-dev.
        futures.append(
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-base.txt",
                    # This is downloaded with bin/bump-sentry.
                    f"{base_path}/sentry-requirements-dev-frozen.txt",
                    "-o",
                    f"{outdir}/requirements-dev-frozen.txt",
                ),
            )
        )

    if repo == "sentry":
        # requirements-dev-only-frozen.txt is only used in sentry
        # (and reused in getsentry) as a fast path for some CI jobs.
        futures.append(
            executor.submit(
                worker,
                (
                    *base_cmd,
                    f"{base_path}/requirements-dev.txt",
                    "-o",
                    f"{outdir}/requirements-dev-only-frozen.txt",
                ),
            )
        )

    rc = check_futures(futures)
    executor.shutdown()
    return rc


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("repo", type=str, help="Repository name.")
    args = parser.parse_args()
    raise SystemExit(main(args.repo))
