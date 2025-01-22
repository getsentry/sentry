import logging
import os
import sys

import click
import sentry_sdk

import sentry
from sentry.utils.imports import import_string


@click.group(context_settings={"max_content_width": 150})
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


# TODO(mattrobenolt): Autodiscover commands?
for cmd in map(
    import_string,
    (
        "sentry.runner.commands.backup.backup",
        "sentry.runner.commands.backup.export",
        "sentry.runner.commands.backup.import_",
        "sentry.runner.commands.cleanup.cleanup",
        "sentry.runner.commands.config.config",
        "sentry.runner.commands.configoptions.configoptions",
        "sentry.runner.commands.createflag.createflag",
        "sentry.runner.commands.createuser.createuser",
        "sentry.runner.commands.devserver.devserver",
        "sentry.runner.commands.django.django",
        "sentry.runner.commands.exec.exec_",
        "sentry.runner.commands.sendmail.sendmail",
        "sentry.runner.commands.execfile.execfile",
        "sentry.runner.commands.files.files",
        "sentry.runner.commands.help.help",
        "sentry.runner.commands.init.init",
        "sentry.runner.commands.killswitches.killswitches",
        "sentry.runner.commands.migrations.migrations",
        "sentry.runner.commands.plugins.plugins",
        "sentry.runner.commands.queues.queues",
        "sentry.runner.commands.repair.repair",
        "sentry.runner.commands.rpcschema.rpcschema",
        "sentry.runner.commands.run.run",
        "sentry.runner.commands.start.start",
        "sentry.runner.commands.tsdb.tsdb",
        "sentry.runner.commands.upgrade.upgrade",
        "sentry.runner.commands.permissions.permissions",
        "sentry.runner.commands.devservices.devservices",
        "sentry.runner.commands.performance.performance",
        "sentry.runner.commands.spans.spans",
        "sentry.runner.commands.spans.write_hashes",
        "sentry.runner.commands.llm.llm",
        "sentry.runner.commands.workstations.workstations",
    ),
):
    cli.add_command(cmd)


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
        # We do this here because `configure_structlog` executes later
        logging.basicConfig(format="%(levelname)s:%(message)s", level=logging.INFO)
        logger = logging.getLogger(__name__)

        try:
            func(**kwargs)
        except Exception as e:
            # This reports errors sentry-devservices
            with sentry_sdk.init(dsn=os.environ["SENTRY_DEVSERVICES_DSN"]):
                if os.environ.get("USER"):
                    sentry_sdk.set_user({"username": os.environ.get("USER")})
                sentry_sdk.capture_exception(e)
                logger.info("We have reported the error below to Sentry")
            raise
    else:
        func(**kwargs)
