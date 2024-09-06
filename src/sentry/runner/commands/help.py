import click


@click.command()
@click.pass_context
def help(ctx: click.Context) -> None:
    "Show this message and exit."
    assert ctx.parent is not None
    click.echo(ctx.parent.get_help())
