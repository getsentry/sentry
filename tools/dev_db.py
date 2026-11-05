"""Create, drop, migrate, and reset the local development databases."""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from collections.abc import Sequence

POSTGRES_CONTAINER = "postgres-postgres-1"
DATABASES = ("sentry", "control", "region", "secondary")


def _pg(*cmd: str) -> list[str]:
    return ["docker", "exec", POSTGRES_CONTAINER, *cmd, "-h", "127.0.0.1", "-U", "postgres"]


def _sentry(*args: str) -> None:
    # sys.executable keeps every step on the interpreter that runs this module.
    subprocess.run((sys.executable, "-m", "sentry", *args), check=True)


def create() -> None:
    for name in DATABASES:
        print(f"--> Creating '{name}' database", flush=True)
        proc = subprocess.run(
            (*_pg("createdb"), "-E", "utf-8", name), capture_output=True, text=True
        )
        if proc.returncode != 0 and f'database "{name}" already exists' not in proc.stderr:
            sys.stderr.write(proc.stderr)
            raise subprocess.CalledProcessError(proc.returncode, proc.args)


def drop() -> None:
    for name in DATABASES:
        print(f"--> Dropping '{name}' database", flush=True)
        subprocess.run((*_pg("dropdb"), "--if-exists", name), check=True)


def migrate() -> None:
    create()
    print("--> Applying migrations", flush=True)
    _sentry("upgrade", "--noinput")


def reset() -> None:
    drop()
    migrate()
    print("--> Creating a superuser account", flush=True)
    if "GITHUB_ACTIONS" in os.environ:
        _sentry(
            "createuser", "--superuser", "--email", "foo@tbd.com", "--no-password", "--no-input"
        )
    else:
        _sentry(
            "createuser",
            "--superuser",
            "--email",
            "admin@sentry.io",
            "--password",
            "admin",
            "--no-input",
        )
        print("Password is admin.")
    print("Finished resetting database. To load mock data, run `./bin/load-mocks`")


COMMANDS = {"create": create, "drop": drop, "migrate": migrate, "reset": reset}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=COMMANDS)
    args = parser.parse_args(argv)
    try:
        COMMANDS[args.command]()
    except subprocess.CalledProcessError as e:
        print(f"--> Failed: {shlex.join(e.cmd)}", file=sys.stderr)
        return e.returncode or 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
