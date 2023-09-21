from __future__ import annotations

import click

from sentry.backup.exports import (
    export_in_config_scope,
    export_in_global_scope,
    export_in_organization_scope,
    export_in_user_scope,
)
from sentry.backup.helpers import ImportFlags
from sentry.backup.imports import (
    import_in_global_scope,
    import_in_organization_scope,
    import_in_user_scope,
)
from sentry.runner.decorators import configuration

MERGE_USERS_HELP = """If this flag is set and users in the import JSON have matching usernames to
                   those already in the database, the existing users are used instead and their
                   associated user scope models are not updated. If this flag is not set, new users
                   are always created in the event of a collision, with the new user receiving a
                   random suffix to their username."""

OVERWRITE_CONFIGS_HELP = """Imports are generally non-destructive of old data. However, if this flag
                         is set and a global configuration, like an option or a relay id, collides
                         with an existing value, the new value will overwrite the existing one. If
                         the flag is left in its (default) unset state, the old value will be
                         retained in the event of a collision."""


def parse_filter_arg(filter_arg: str) -> set[str] | None:
    filter_by = None
    if filter_arg:
        filter_by = set(filter_arg.split(","))

    return filter_by


@click.group(name="import")
def import_():
    """Performs non-destructive imports of core data for a Sentry installation."""


@import_.command(name="users")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--filter_usernames",
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@click.option(
    "--merge_users",
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_users(src, filter_usernames, merge_users, silent):
    """
    Import the Sentry users from an exported JSON file.
    """

    import_in_user_scope(
        src,
        flags=ImportFlags(merge_users=merge_users),
        user_filter=parse_filter_arg(filter_usernames),
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@import_.command(name="organizations")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--merge_users",
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option(
    "--filter_org_slugs",
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are imported. "
    "Users not members of at least one organization in this set will not be imported.",
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_organizations(src, filter_org_slugs, merge_users, silent):
    """
    Import the Sentry organizations, and all constituent Sentry users, from an exported JSON file.
    """

    import_in_organization_scope(
        src,
        flags=ImportFlags(merge_users=merge_users),
        org_filter=parse_filter_arg(filter_org_slugs),
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@import_.command(name="global")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--overwrite_configs",
    default=False,
    is_flag=True,
    help=OVERWRITE_CONFIGS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_global(src, silent, overwrite_configs):
    """
    Import all Sentry data from an exported JSON file.
    """

    import_in_global_scope(
        src,
        flags=ImportFlags(overwrite_configs=overwrite_configs),
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@click.group(name="export")
def export():
    """Exports core data for the Sentry installation."""


@export.command(name="users")
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent",
    default=2,
    type=int,
    help="Number of spaces to indent for the JSON output. (default: 2)",
)
@click.option(
    "--filter_usernames",
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@configuration
def export_users(dest, silent, indent, filter_usernames):
    """
    Export all Sentry users in the JSON format.
    """

    export_in_user_scope(
        dest,
        indent=indent,
        user_filter=parse_filter_arg(filter_usernames),
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@export.command(name="organizations")
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent",
    default=2,
    type=int,
    help="Number of spaces to indent for the JSON output. (default: 2)",
)
@click.option(
    "--filter_org_slugs",
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are exported. "
    "Users not members of at least one organization in this set will not be exported.",
)
@configuration
def export_organizations(dest, silent, indent, filter_org_slugs):
    """
    Export all Sentry organizations, and their constituent users, in the JSON format.
    """

    export_in_organization_scope(
        dest,
        indent=indent,
        org_filter=parse_filter_arg(filter_org_slugs),
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@export.command(name="config")
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent",
    default=2,
    type=int,
    help="Number of spaces to indent for the JSON output. (default: 2)",
)
@configuration
def export_config(dest, silent, indent):
    """
    Export all configuration and administrator accounts needed to set up this Sentry instance.
    """

    export_in_config_scope(
        dest,
        indent=indent,
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )


@export.command(name="global")
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent",
    default=2,
    type=int,
    help="Number of spaces to indent for the JSON output. (default: 2)",
)
@configuration
def export_global(dest, silent, indent):
    """
    Export all Sentry data in the JSON format.
    """

    export_in_global_scope(
        dest,
        indent=indent,
        printer=(lambda *args, **kwargs: None) if silent else click.echo,
    )
