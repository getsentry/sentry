from __future__ import annotations

import argparse
import os
from collections.abc import Sequence
from concurrent.futures import Future, ThreadPoolExecutor
from os.path import abspath
from subprocess import CalledProcessError, run

from tools.lib import gitroot


def worker(args: tuple[str, ...], cwd: str | None = None) -> None:
    env = os.environ.copy()
    env["CUSTOM_COMPILE_COMMAND"] = "make freeze-requirements"

    run(args, check=True, capture_output=True, env=env, cwd=cwd)


def check_futures(futures: list[Future[None]]) -> int:
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


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args(argv)

    base_path = abspath(gitroot())

    base_cmd = (
        "uv",
        "pip",
        "compile",
        "--allow-unsafe",
        "--no-annotate",
        "--quiet",
        "--strip-extras",
        "--emit-index-url",
        "--default-index",
        "https://pypi.devinfra.sentry.io/simple",
    )

    executor = ThreadPoolExecutor(max_workers=2)
    futures = [
        executor.submit(
            worker,
            (
                *base_cmd,
                "requirements-base.txt",
                "requirements-getsentry.txt",
                "-o",
                "requirements-frozen.txt",
            ),
            cwd=base_path,
        ),
        executor.submit(
            worker,
            (
                *base_cmd,
                "requirements-base.txt",
                "requirements-getsentry.txt",
                "requirements-dev.txt",
                "-o",
                "requirements-dev-frozen.txt",
            ),
            cwd=base_path,
        ),
    ]

    rc = check_futures(futures)
    executor.shutdown()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
