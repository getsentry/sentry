"""Print the top-level `sentry` CLI commands, one per line.

self-hosted/Dockerfile saves this list so docker_entrypoint.py can route
e.g. `docker run <image> upgrade` to `sentry upgrade`.
"""

import click

from sentry.runner.main import cli


def main() -> int:
    for name in cli.list_commands(click.Context(cli)):
        print(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
