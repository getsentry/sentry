import click

from sentry.runner.decorators import configuration


@click.command(add_help_option=False, context_settings=dict(ignore_unknown_options=True))
@click.argument("management_args", nargs=-1, type=click.UNPROCESSED)
@configuration
@click.pass_context
def django(ctx: click.Context, management_args: tuple[str, ...]) -> None:
    "Execute Django subcommands."
    from django.core.management import execute_from_command_line

    execute_from_command_line(argv=[ctx.command_path, *management_args])
