import click


@click.group()
def plugins():
    "Manage Sentry plugins."


@plugins.command()
def list():
    "List all installed plugins"
    from pkg_resources import iter_entry_points

    for ep in iter_entry_points("sentry.plugins"):
        click.echo(f"{ep.name}: {ep.dist.project_name} {ep.dist.version} ({ep.dist.location})")
