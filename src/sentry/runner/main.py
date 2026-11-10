import logging
import os
import shutil
import sys
import sysconfig
from collections.abc import Sequence

import click

import sentry
from sentry.utils.imports import import_string

# Commands import lazily: importing all of them up front costs about a second,
# which every invocation paid before click even parsed argv.
_COMMANDS = {
    "backup": "sentry.runner.commands.backup.backup",
    "export": "sentry.runner.commands.backup.export",
    "import": "sentry.runner.commands.backup.import_",
    "cleanup": "sentry.runner.commands.cleanup.cleanup",
    "config": "sentry.runner.commands.config.config",
    "configoptions": "sentry.runner.commands.configoptions.configoptions",
    "createflag": "sentry.runner.commands.createflag.createflag",
    "createissueflag": "sentry.runner.commands.createflag.createissueflag",
    "createorg": "sentry.runner.commands.createorg.createorg",
    "createproject": "sentry.runner.commands.createproject.createproject",
    "createuser": "sentry.runner.commands.createuser.createuser",
    "devserver": "sentry.runner.commands.devserver.devserver",
    "django": "sentry.runner.commands.django.django",
    "exec": "sentry.runner.commands.exec.exec_",
    "sendmail": "sentry.runner.commands.sendmail.sendmail",
    "execfile": "sentry.runner.commands.execfile.execfile",
    "files": "sentry.runner.commands.files.files",
    "help": "sentry.runner.commands.help.help",
    "init": "sentry.runner.commands.init.init",
    "impact": "sentry.runner.commands.impact.impact",
    "migrations": "sentry.runner.commands.migrations.migrations",
    "migrate_debugfiles_to_objectstore": "sentry.runner.commands.migrate_debugfiles_to_objectstore.migrate_debugfiles_to_objectstore",
    "repair": "sentry.runner.commands.repair.repair",
    "rpcschema": "sentry.runner.commands.rpcschema.rpcschema",
    "run": "sentry.runner.commands.run.run",
    "start": "sentry.runner.commands.start.start",
    "tsdb": "sentry.runner.commands.tsdb.tsdb",
    "upgrade": "sentry.runner.commands.upgrade.upgrade",
    "permissions": "sentry.runner.commands.permissions.permissions",
    "devservices": "sentry.runner.commands.devservices.devservices",
    "performance": "sentry.runner.commands.performance.performance",
    "spans": "sentry.runner.commands.spans.spans",
    "write-hashes": "sentry.runner.commands.spans.write_hashes",
    "notifications": "sentry.runner.commands.notifications.notifications",
    "deletions": "sentry.runner.commands.deletions.deletions",
}

# Set on the Sentry CLI we exec, so a second server `sentry` on PATH can't hand
# the command back and loop.
_FALLBACK_ENV = "SENTRY_SERVER_CLI_FALLBACK"


def _exec_sentry_cli(args: Sequence[str]) -> None:
    """
    Hand a command this CLI doesn't have to the Sentry CLI
    (https://cli.sentry.dev), which is also called `sentry`. Inside a checkout
    the virtualenv shadows it on PATH. Returns if there's no other `sentry`.
    """
    if os.environ.get(_FALLBACK_ENV):
        return
    own_bin = os.path.realpath(sysconfig.get_path("scripts"))
    path = os.pathsep.join(
        p
        for p in os.environ.get("PATH", "").split(os.pathsep)
        if p and os.path.realpath(p) != own_bin
    )
    other = shutil.which("sentry", path=path)
    if other is None:
        return
    os.environ[_FALLBACK_ENV] = "1"
    os.execv(other, ["sentry", *args])


class _SentryGroup(click.Group):
    def list_commands(self, ctx: click.Context) -> list[str]:
        return sorted({*self.commands, *_COMMANDS})

    def get_command(self, ctx: click.Context, cmd_name: str) -> click.Command | None:
        if cmd_name not in self.commands and cmd_name in _COMMANDS:
            self.add_command(import_string(_COMMANDS[cmd_name]), cmd_name)
        return super().get_command(ctx, cmd_name)

    def resolve_command(
        self, ctx: click.Context, args: list[str]
    ) -> tuple[str | None, click.Command | None, list[str]]:
        if args and not args[0].startswith("-") and self.get_command(ctx, args[0]) is None:
            _exec_sentry_cli(args)
        return super().resolve_command(ctx, args)


@click.group(cls=_SentryGroup, context_settings={"max_content_width": 150})
@click.option(
    "--config",
    default="",
    envvar="SENTRY_CONF",
    help="Path to configuration files.",
    metavar="PATH",
)
@click.version_option(version=sentry.__semantic_version__)
def cli(config: str) -> None:
    """Sentry is cross-platform crash reporting built with love.

    The configuration file is looked up in the `~/.sentry` config
    directory but this can be overridden with the `SENTRY_CONF`
    environment variable or be explicitly provided through the
    `--config` parameter.
    """
    # Elevate --config option to SENTRY_CONF env var, and just assume this
    # always will exist down the line
    if config:
        os.environ["SENTRY_CONF"] = config
    os.environ.setdefault("SENTRY_CONF", "~/.sentry")


def _make_django_command(
    name: str, django_command: str | None = None, help: str | None = None
) -> click.Command:
    "A wrapper to convert a Django subcommand a Click command"
    if django_command is None:
        django_command = name

    @click.command(
        name=name,
        help=help,
        add_help_option=False,
        context_settings=dict(ignore_unknown_options=True),
    )
    @click.argument("management_args", nargs=-1, type=click.UNPROCESSED)
    @click.pass_context
    def inner(ctx: click.Context, management_args: tuple[str, ...]) -> None:
        from sentry.runner.commands.django import django

        ctx.params["management_args"] = (django_command,) + management_args
        ctx.forward(django)

    return inner


cli.add_command(_make_django_command("shell", help="Run a Python interactive interpreter."))


def _get_prog() -> str:
    """
    Extract the proper program executable.

    In the case of `python -m sentry`, we want to detect this and
    make sure we return something useful rather than __main__.py
    """
    try:
        if os.path.basename(sys.argv[0]) in ("__main__.py", "-c"):
            return "%s -m sentry" % sys.executable
    except (AttributeError, TypeError, IndexError):
        pass
    return "sentry"


def main() -> None:
    func = cli
    kwargs = {
        "prog_name": _get_prog(),
        "obj": {},
        "max_content_width": 100,
    }
    # This variable is *only* set as part of direnv/.envrc, thus, we cannot affect production
    if os.environ.get("SENTRY_DEVSERVICES_DSN"):
        import sentry_sdk

        # We do this here because `configure_structlog` executes later
        logging.basicConfig(format="%(levelname)s:%(message)s", level=logging.INFO)
        logger = logging.getLogger(__name__)

        try:
            func(**kwargs)
        except Exception as e:
            # This reports errors sentry-devservices
            with sentry_sdk.new_scope() as scope:
                scope.set_client(sentry_sdk.Client(dsn=os.environ["SENTRY_DEVSERVICES_DSN"]))
                if os.environ.get("USER"):
                    sentry_sdk.set_user({"username": os.environ.get("USER")})
                sentry_sdk.capture_exception(e)
                logger.info("We have reported the error below to Sentry")
            raise
    else:
        func(**kwargs)
