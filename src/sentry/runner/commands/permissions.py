from __future__ import annotations

from typing import TYPE_CHECKING

import click
from django.db import router

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from sentry.users.models.user import User


def user_param_to_user(value: str) -> User:
    from sentry.utils.auth import find_users

    users = find_users(value)
    if not users:
        raise click.ClickException(f"No user matching `{value}`")
    if len(users) > 1:
        raise click.ClickException(f"Found more than one user matching `{value}`")
    user = users[0]
    if not user.is_superuser:
        raise click.ClickException(f"User `{user.username}` does not have superuser status")
    return user


@click.group()
def permissions() -> None:
    "Manage Permissions for Users."


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@click.option("--permission", "-p", default=None, required=True)
@configuration
def add(user: str, permission: str) -> None:
    "Add a permission to a user."
    from django.db import IntegrityError, transaction

    from sentry.users.models.userpermission import UserPermission

    user_inst = user_param_to_user(user)

    try:
        with transaction.atomic(router.db_for_write(UserPermission)):
            UserPermission.objects.create(user=user_inst, permission=permission)
    except IntegrityError:
        click.echo(f"Permission already exists for `{user_inst.username}`")
    else:
        click.echo(f"Added permission `{permission}` to `{user_inst.username}`")


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@click.option("--permission", "-p", default=None, required=True)
@configuration
def remove(user: str, permission: str) -> None:
    "Remove a permission from a user."
    from sentry.users.models.userpermission import UserPermission

    user_inst = user_param_to_user(user)

    try:
        up = UserPermission.objects.get(user=user_inst, permission=permission)
    except UserPermission.DoesNotExist:
        click.echo(f"Permission does not exist for `{user_inst.username}`")
    else:
        up.delete()
        click.echo(f"Removed permission `{permission}` from `{user_inst.username}`")


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@configuration
def list(user: str) -> None:
    "List permissions for a user."
    from sentry.users.models.userpermission import UserPermission

    user_inst = user_param_to_user(user)
    up_list = UserPermission.objects.filter(user=user_inst).order_by("permission")
    click.echo(f"Permissions for `{user_inst.username}`:")
    for permission in up_list:
        click.echo(f"- {permission.permission}")
