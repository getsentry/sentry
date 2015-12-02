from __future__ import absolute_import, print_function

from django.db.models.signals import post_syncdb

from sentry.models import User


def create_first_user(app, created_models, verbosity, db, **kwargs):
    if User not in created_models:
        return
    if not kwargs.get('interactive', True):
        return

    import click
    import time
    if not click.confirm('\nWould you like to create a user account now?', default=True):
        # Not using `abort=1` because we don't want to exit out from further execution
        click.echo('\nRun `sentry createuser` to do this later.\n')
        time.sleep(2)
        return

    from sentry.runner.commands.createuser import createuser
    try:
        createuser.main(args=[], obj={})
        click.echo()
    except SystemExit as e:
        # click normally wants to exit the process, but we want to just continue execution
        if e.code == 0:
            return
        click.echo('\nRun `sentry createuser` to do this later.\n')
        time.sleep(2)


post_syncdb.connect(
    create_first_user,
    dispatch_uid="create_first_user",
    weak=False,
)
