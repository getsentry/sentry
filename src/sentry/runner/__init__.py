import datetime
import logging
import os
import sys

import click
import sentry_sdk

import sentry
from sentry.utils.compat import map
from sentry.utils.imports import import_string

# We need to run this here because of a concurrency bug in Python's locale
# with the lazy initialization.
datetime.datetime.strptime("", "")

# Parse out a pretty version for use with --version
if sentry.__build__ is None:
    version_string = sentry.VERSION
else:
    version_string = f"{sentry.VERSION} ({sentry.__build__[:12]})"


@click.group(context_settings={"max_content_width": 150})
@click.option(
    "--config",
    default="",
    envvar="SENTRY_CONF",
    help="Path to configuration files.",
    metavar="PATH",
)
@click.version_option(version=version_string)
@click.pass_context
def cli(ctx, config):
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
list(
    map(
        lambda cmd: cli.add_command(import_string(cmd)),
        (
            "sentry.runner.commands.backup.export",
            "sentry.runner.commands.backup.import_",
            "sentry.runner.commands.cleanup.cleanup",
            "sentry.runner.commands.config.config",
            "sentry.runner.commands.createuser.createuser",
            "sentry.runner.commands.devserver.devserver",
            "sentry.runner.commands.django.django",
            "sentry.runner.commands.exec.exec_",
            "sentry.runner.commands.files.files",
            "sentry.runner.commands.help.help",
            "sentry.runner.commands.init.init",
            "sentry.runner.commands.migrations.migrations",
            "sentry.runner.commands.plugins.plugins",
            "sentry.runner.commands.queues.queues",
            "sentry.runner.commands.repair.repair",
            "sentry.runner.commands.run.run",
            "sentry.runner.commands.start.start",
            "sentry.runner.commands.tsdb.tsdb",
            "sentry.runner.commands.upgrade.upgrade",
            "sentry.runner.commands.permissions.permissions",
            "sentry.runner.commands.devservices.devservices",
        ),
    )
)


def make_django_command(name, django_command=None, help=None):
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
    def inner(ctx, management_args):
        from sentry.runner.commands.django import django

        ctx.params["management_args"] = (django_command,) + management_args
        ctx.forward(django)

    return inner


list(
    map(
        cli.add_command,
        (make_django_command("shell", help="Run a Python interactive interpreter."),),
    )
)


def configure():
    """
    Kick things off and configure all the things.

    A guess is made as to whether the entrypoint is coming from Click
    or from another invocation of `configure()`. If Click, we're able
    to pass along the Click context object.
    """
    from .settings import configure, discover_configs

    try:
        ctx = click.get_current_context()
    except RuntimeError:
        ctx = None
    _, py, yaml = discover_configs()

    # TODO(mattrobenolt): Surface this also as a CLI option?
    skip_service_validation = (
        "SENTRY_SKIP_BACKEND_VALIDATION" in os.environ
        or "SENTRY_SKIP_SERVICE_VALIDATION" in os.environ
    )
    configure(ctx, py, yaml, skip_service_validation)


def get_prog():
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


class UnknownCommand(ImportError):
    pass


def call_command(name, obj=None, **kwargs):
    try:
        command = import_string(name)
    except (ImportError, AttributeError):
        raise UnknownCommand(name)

    with command.make_context("sentry", [], obj=obj or {}) as ctx:
        ctx.params.update(kwargs)
        try:
            command.invoke(ctx)
        except click.Abort:
            click.echo("Aborted!", err=True)


def main():
    func = cli
    kwargs = {
        "prog_name": get_prog(),
        "obj": {},
        "max_content_width": 100,
    }
    # This variable is *only* set as part of direnv/.envrc, thus, we cannot affect production
    if os.environ.get("SENTRY_DEVENV_DSN"):
        # We do this here because `configure_structlog` executes later
        logging.basicConfig(format="%(levelname)s:%(message)s", level=logging.INFO)
        logger = logging.getLogger(__name__)

        logger.info(
            "The Sentry runner will report development issues to Sentry.io. "
            "Use SENTRY_DEVENV_NO_REPORT to avoid reporting issues."
        )
        try:
            func(**kwargs)
        except Exception as e:
            # This reports to the project sentry-dev-env
            with sentry_sdk.init(dsn=os.environ["SENTRY_DEVENV_DSN"]):
                if os.environ.get("USER"):
                    sentry_sdk.set_user({"username": os.environ.get("USER")})
                sentry_sdk.capture_exception(e)
                logger.info("We have reported the error below to Sentry")
            raise e
    else:
        func(**kwargs)
