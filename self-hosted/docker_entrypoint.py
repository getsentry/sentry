import os
import sys

# Generated at build time by sentry.build.dump_cli_commands, see self-hosted/Dockerfile.
with open("/sentry-commands.txt") as f:
    SENTRY_COMMANDS = frozenset(f.read().split())


def main(argv: list[str]) -> None:
    if not argv:
        return

    # Flags and sentry-server subcommands, e.g. `--help` or `run web`, go to sentry-server.
    if argv[0].startswith("-") or argv[0] in SENTRY_COMMANDS:
        argv = ["sentry-server", *argv]

    # tini reaps zombies and forwards signals when sentry runs as PID 1.
    # `sentry` is the deprecated alias for `sentry-server`, see self-hosted/Dockerfile.
    if argv[0] in ("sentry", "sentry-server"):
        argv = ["tini", "--", *argv]

    os.execvp(argv[0], argv)


if __name__ == "__main__":
    main(sys.argv[1:])
