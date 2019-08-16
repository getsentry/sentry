from __future__ import absolute_import, print_function

import click

from sentry.runner.decorators import configuration


def user_param_to_user(value):
    from sentry.utils.auth import find_users

    users = find_users(value)
    if not users:
        raise click.ClickException(u"No user matching `{}`".format(value))
    if len(users) > 1:
        raise click.ClickException(u"Found more than one user matching `{}`".format(value))
    user = users[0]
    if not user.is_superuser:
        raise click.ClickException(
            u"User `{}` does not have superuser status".format(user.username)
        )
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
        click.echo(u"Permission already exists for `{}`".format(user.username))
    else:
        click.echo(u"Added permission `{}` to `{}`".format(permission, user.username))


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
        click.echo(u"Permission does not exist for `{}`".format(user.username))
    else:
        up.delete()
        click.echo(u"Removed permission `{}` from `{}`".format(permission, user.username))


@permissions.command()
@click.option("--user", "-u", default=None, required=True)
@configuration
def list(user):
    "List permissions for a user."
    from sentry.models import UserPermission

    user = user_param_to_user(user)
    up_list = UserPermission.objects.filter(user=user).order_by("permission")
    click.echo(u"Permissions for `{}`:".format(user.username))
    for permission in up_list:
        click.echo(u"- {}".format(permission.permission))
