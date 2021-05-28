import itertools
import textwrap

import click
import yaml

from sentry.runner.decorators import configuration


@click.group()
def killswitches():
    "Manage killswitches for ingestion pipeline."


def _get_edit_template(killswitch_name: str, option_value) -> str:
    from sentry import killswitches

    comments = [
        f"{killswitch_name}: {killswitches.ALL_KILLSWITCH_OPTIONS[killswitch_name].description}",
        "After saving and exiting, your killswitch conditions will be printed in faux-SQL "
        "for you to confirm.",
        "Below a template is given for a single condition. The condition's fields "
        "will be joined with AND, while all conditions will be joined with OR. "
        "All fields need to be set, but can be set to null/~, which is a wildcard.",
    ]

    comments = list(itertools.chain.from_iterable(textwrap.wrap(line) + [""] for line in comments))

    for i, (field, description) in enumerate(
        sorted(killswitches.ALL_KILLSWITCH_OPTIONS[killswitch_name].fields.items())
    ):
        for j, line in enumerate(textwrap.wrap(description)):
            comments.append(f"{' ' if i or j else '-'} # {line}")
        comments.append(f"  {field}: null")

    edit_text = "\n".join(f"# {line}" for line in comments)

    if option_value:
        edit_text += "\n\n"
        edit_text += yaml.dump(option_value)

    return edit_text


@killswitches.command("pull")
@click.argument("killswitch_name", required=True)
@click.argument("outfile", type=click.File("w"), required=True)
@configuration
def _pull(killswitch_name, outfile):
    """
    Save the current state of the given killswitch in a file.

        sentry killswitches pull store.load-shed-pipeline-projects ./killswitch.yml

    The (edited) file can be passed back into:

        sentry killswitches push store.load-shed-pipeline-projects ./killswitch.yml

    Note that in Docker you need to provide absolute paths to your killswitch
    file.
    """

    from sentry import options

    option_value = options.get(killswitch_name)
    outfile.write(_get_edit_template(killswitch_name, option_value))


@killswitches.command("push")
@click.argument("killswitch_name", required=True)
@click.argument("infile", type=click.File("r"), required=True)
@click.option("--yes", is_flag=True, help="skip confirmation prompts, very dangerous")
@configuration
def _push(killswitch_name, infile, yes):
    """
    Write back a killswitch into the DB.

    For a list of killswitches to write, use `sentry killswitches list`.

    For example:

        sentry killswitches pull store.load-shed-pipeline-projects file.txt
        <edit file.txt>
        sentry killswitches push store.load-shed-pipeline-projects file.txt
    """
    from sentry import killswitches, options

    option_value = options.get(killswitch_name)

    edited_text = infile.read()
    try:
        new_option_value = killswitches.validate_user_input(
            killswitch_name, yaml.safe_load(edited_text)
        )
    except ValueError as e:
        click.echo(f"Invalid data: {e}")
        raise click.Abort()

    if option_value == new_option_value:
        click.echo("No changes!", err=True)
        raise click.Abort()

    click.echo("Before:")
    click.echo(killswitches.print_conditions(killswitch_name, option_value))
    click.echo("After:")
    click.echo(killswitches.print_conditions(killswitch_name, new_option_value))

    if not yes:
        click.confirm(
            "Should the changes be applied?", default=False, show_default=True, abort=True
        )
    options.set(killswitch_name, new_option_value)


@killswitches.command("list")
@configuration
def _list():
    """
    List all killswitches and whether they are enabled (and how).
    """

    from sentry import killswitches, options

    for name, info in killswitches.ALL_KILLSWITCH_OPTIONS.items():
        click.echo()
        click.echo(f"{name}")
        click.echo(f"  # {info.description}")
        conditions = killswitches.print_conditions(name, options.get(name))
        click.echo(f"{conditions}")
