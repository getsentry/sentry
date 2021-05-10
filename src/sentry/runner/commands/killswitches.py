import click
import yaml

from sentry.runner.decorators import configuration


@click.group()
def killswitches():
    "Manage killswitches for ingestion pipeline."


def _safe_modify(killswitch_name, modify_func):
    from sentry import killswitches, options

    option_value = options.get(killswitch_name)
    new_option_value = modify_func(option_value)

    if option_value == new_option_value:
        click.echo("No changes!")
        raise click.Abort()

    click.echo("Before:")
    click.echo(killswitches.print_conditions(option_value))
    click.echo("After:")
    click.echo(killswitches.print_conditions(new_option_value))

    click.confirm("Should the changes be applied?", default=False, show_default=True, abort=True)
    options.set(killswitch_name, new_option_value)


@killswitches.command()
@click.argument("killswitch", required=True)
@configuration
def edit(killswitch):
    """
    Edit killswitch conditions all at once using $EDITOR.

    For a list of killswitches to edit, use `sentry killswitches list`.

    For example:

        sentry killswitches edit store.load-shed-pipeline-projects
    """

    from sentry import killswitches

    def edit(option_value):
        edit_text = (
            "# Example, drops transaction events from project 42 and everything from project 43:\n"
            "#\n"
            "# - project_id: 42\n"
            "#   event_type: transaction\n"
            "# - project_id: 43\n"
            "#\n"
            "# After saving and exiting, your killswitch conditions will be printed in faux-SQL\n"
            "# for you to confirm. The above conditions' preview would be:\n"
            "#\n"
            "# DROP DATA WHERE\n"
            "#   (project_id = 42 AND event_type = transaction) OR\n"
            "#   (project_id = 43)\n"
            "#\n"
            f"# {killswitch}: {killswitches.ALL_KILLSWITCH_OPTIONS[killswitch].description}\n"
            f"# Available fields:\n"
        )

        for field in killswitches.ALL_KILLSWITCH_OPTIONS[killswitch].fields:
            edit_text += f"#  - {field}\n"

        if option_value:
            edit_text += "\n"
            edit_text += yaml.dump(option_value)

        edited_text = click.edit(edit_text)
        if edited_text is None:
            return option_value

        return killswitches.normalize_value(yaml.safe_load(edited_text))

    _safe_modify(killswitch, edit)


@killswitches.command()
@configuration
def list():
    """
    List all killswitches and whether they are enabled (and how).
    """

    from sentry import killswitches, options

    for name, info in killswitches.ALL_KILLSWITCH_OPTIONS.items():
        click.echo()
        click.echo(f"{name}")
        click.echo(f"  # {info.description}")
        conditions = killswitches.print_conditions(options.get(name))
        click.echo(f"{conditions}")
