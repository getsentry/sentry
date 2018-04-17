from __future__ import absolute_import, print_function

import click

from sentry.runner.decorators import configuration


def user_param_to_user(value):
    from sentry.utils.auth import find_users

    users = find_users(value)
    if not users:
        click.abort('No user matching `{}`'.format(value))
    if len(users) > 1:
        click.abort('Found more than one user matching `{}`'.format(value))
    user = users[0]
    if not user.is_superuser:
        click.abort('User `{}` does not have superuser status'.format(user.username))
    return user


@click.group()
def permissions():
    "Manage Permissions for Users."


@permissions.command()
@click.option('--user', '-u', default=None, required=True)
@click.option('--permission', '-p', default=None, required=True)
@configuration
def add(user, permission):
    "Add a permission to a user."
    from django.db import IntegrityError, transaction
    from sentry.models import UserPermission

    user = user_param_to_user(user)

    try:
        with transaction.atomic():
            UserPermission.objects.create(
                user=user,
                permission=permission,
            )
    except IntegrityError:
        click.echo('Permission already exists for `{}`'.format(user.username))
    else:
        click.echo('Added permission `{}` to `{}`'.format(permission, user.username))


@permissions.command()
@click.option('--user', '-u', default=None, required=True)
@click.option('--permission', '-p', default=None, required=True)
@configuration
def remove(user, permission):
    "Remove a permission from a user."
    from sentry.models import UserPermission

    user = user_param_to_user(user)

    try:
        up = UserPermission.objects.get(
            user=user,
            permission=permission,
        )
    except UserPermission.DoesNotExist:
        click.echo('Permission does not exist for `{}`'.format(user.username))
    else:
        up.delete()
        click.echo('Removed permission `{}` from `{}`'.format(permission, user.username))


@permissions.command()
@click.option('--user', '-u', default=None, required=True)
@configuration
def list(user):
    "List permissions for a user."
    from sentry.models import UserPermission

    user = user_param_to_user(user)
    up_list = UserPermission.objects.filter(
        user=user,
    ).order_by('permission')
    click.echo('Permissions for `{}`:'.format(user.username))
    for permission in up_list:
        click.echo('- {}'.format(permission.permission))
