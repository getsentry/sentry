import importlib
import importlib.util
import logging
import os
import pkgutil
import shutil
import sys
import sysconfig
from collections.abc import Sequence

import click

import sentry
from sentry.runner import commands


# Command `foo-bar` is the click command of that name in
# `sentry/runner/commands/foo_bar.py`. Looking it up by module name imports only
# that module: importing them all costs about a second.
def _command_module(cmd_name: str) -> str | None:
    module = cmd_name.replace("-", "_")
    if not module.isidentifier():
        return None
    return f"{commands.__name__}.{module}"


def _module_commands(module_name: str) -> list[click.Command]:
    module = importlib.import_module(module_name)
    # Check with issubclass(type(...)): isinstance() would evaluate lazy module
    # attributes such as django.conf.settings.
    return [
        value
        for value in vars(module).values()
        if issubclass(type(value), click.Command)
        and value.name
        and _command_module(value.name) == module_name
    ]


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
        # Only --help, completion, and dump_cli_commands list commands, and
        # --help needs every command's help text anyway, so this imports all.
        names = set(self.commands)
        for info in pkgutil.iter_modules(commands.__path__):
            if not info.ispkg:
                module = f"{commands.__name__}.{info.name}"
                names.update(c.name for c in _module_commands(module) if c.name)
        return sorted(names)

    def get_command(self, ctx: click.Context, cmd_name: str) -> click.Command | None:
        if cmd_name not in self.commands:
            module = _command_module(cmd_name)
            if module is not None and importlib.util.find_spec(module) is not None:
                for command in _module_commands(module):
                    if command.name == cmd_name:
                        self.add_command(command)
        return super().get_command(ctx, cmd_name)

    def parse_args(self, ctx: click.Context, args: list[str]) -> list[str]:
        # The Sentry CLI takes global flags, like --verbose, before the command.
        # Click would reject those here, before resolve_command can hand off.
        options = {
            opt: param
            for param in self.get_params(ctx)
            for opt in (*param.opts, *param.secondary_opts)
        }
        i = 0
        while i < len(args) and args[i].startswith("-") and args[i] != "--":
            name, has_value, _ = args[i].partition("=")
            param = options.get(name)
            if param is None:
                if not ctx.resilient_parsing:
                    _exec_sentry_cli(args[i:])
                break
            if param.is_eager:
                break
            takes_value = isinstance(param, click.Option) and not param.is_flag
            i += 2 if takes_value and not has_value else 1
        return super().parse_args(ctx, args)

    def resolve_command(
        self, ctx: click.Context, args: list[str]
    ) -> tuple[str | None, click.Command | None, list[str]]:
        # Shell completion parses resiliently. It must not exec anything.
        if (
            not ctx.resilient_parsing
            and args
            and not args[0].startswith("-")
            and self.get_command(ctx, args[0]) is None
        ):
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
