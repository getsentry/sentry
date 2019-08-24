from __future__ import absolute_import, print_function

import click


@click.command()
@click.pass_context
def help(ctx):
    "Show this message and exit."
    click.echo(ctx.parent.get_help())
