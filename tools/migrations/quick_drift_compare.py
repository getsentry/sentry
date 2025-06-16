"""approximate a squash and compare the schema drift"""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from typing import IO, NoReturn


def _get_repo() -> str:
    repo = os.path.basename(os.getcwd())
    assert repo in {"sentry", "getsentry"}, repo
    return repo


def _run(*cmd: str, stdout: IO[bytes] | None = None) -> None:
    print(f"+ {shlex.join(cmd)}", file=sys.stderr, flush=True)
    subprocess.check_call(cmd, stdout=stdout)


def main() -> NoReturn:
    _run("make", "drop-db", "apply-migrations")

    with open("schema-before", "wb") as f:
        _run(
            *("docker", "exec", "sentry-postgres-1"),
            *("pg_dumpall", "-U", "postgres", "-s"),
            stdout=f,
        )

    _run("make", "drop-db", "create-db")

    _run(_get_repo(), "django", "devsyncdb")

    with open("schema-after", "wb") as f:
        _run(
            *("docker", "exec", "sentry-postgres-1"),
            *("pg_dumpall", "-U", "postgres", "-s"),
            stdout=f,
        )

    cmd = (sys.executable, "-um", "tools.migrations.compare", "schema-before", "schema-after")
    os.execvp(cmd[0], cmd)


if __name__ == "__main__":
    raise SystemExit(main())
