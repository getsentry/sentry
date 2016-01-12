from __future__ import absolute_import, print_function

from django.db import router
from django.db.models.signals import post_syncdb

from sentry.models import User


def create_first_user(app, created_models, verbosity, db, **kwargs):
    if User not in created_models:
        return
    if not router.allow_syncdb(db, User):
        return
    if not kwargs.get('interactive', True):
        return

    import click
    if not click.confirm('\nWould you like to create a user account now?', default=True):
        # Not using `abort=1` because we don't want to exit out from further execution
        click.echo('\nRun `sentry createuser` to do this later.\n')
        return

    from sentry.runner import call_command
    call_command('sentry.runner.commands.createuser.createuser')


post_syncdb.connect(
    create_first_user,
    dispatch_uid="create_first_user",
    weak=False,
)
