import click

from sentry.runner.decorators import configuration


def user_param_to_user(value):
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
def permissions():
    "Manage Permissions for Users."


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@click.option("--permission", "-p", default=None, required=True)
@configuration
def add(user, permission):
    "Add a permission to a user."
    from django.db import IntegrityError, transaction

    from sentry.models import UserPermission

    user = user_param_to_user(user)

    try:
        with transaction.atomic():
            UserPermission.objects.create(user=user, permission=permission)
    except IntegrityError:
        click.echo(f"Permission already exists for `{user.username}`")
    else:
        click.echo(f"Added permission `{permission}` to `{user.username}`")


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@click.option("--permission", "-p", default=None, required=True)
@configuration
def remove(user, permission):
    "Remove a permission from a user."
    from sentry.models import UserPermission

    user = user_param_to_user(user)

    try:
        up = UserPermission.objects.get(user=user, permission=permission)
    except UserPermission.DoesNotExist:
        click.echo(f"Permission does not exist for `{user.username}`")
    else:
        up.delete()
        click.echo(f"Removed permission `{permission}` from `{user.username}`")


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@configuration
def list(user):
    "List permissions for a user."
    from sentry.models import UserPermission

    user = user_param_to_user(user)
    up_list = UserPermission.objects.filter(user=user).order_by("permission")
    click.echo(f"Permissions for `{user.username}`:")
    for permission in up_list:
        click.echo(f"- {permission.permission}")
