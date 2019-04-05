from __future__ import absolute_import, print_function

from django.db import router
from django.db.models.signals import post_syncdb

from sentry.models import User


def create_first_user(using=None, db=None, app=None, app_config=None, **kwargs):
    if using is None:
        using = db

    # this is super confusing
    if app and app.__name__ != "sentry.models":
        return

    if app_config and app_config.name != "sentry":
        return

    if User.objects.exists():
        return

    if hasattr(router, "allow_migrate"):
        if not router.allow_migrate(db, User):
            return
    else:
        if not router.allow_syncdb(db, User):
            return
    if not kwargs.get("interactive", True):
        return

    import click

    if not click.confirm("\nWould you like to create a user account now?", default=True):
        # Not using `abort=1` because we don't want to exit out from further execution
        click.echo("\nRun `sentry createuser` to do this later.\n")
        return

    from sentry.runner import call_command

    call_command("sentry.runner.commands.createuser.createuser", superuser=True)


try:
    from django.db.models.signals import post_migrate
except ImportError:
    pass
else:
    post_migrate.connect(create_first_user, dispatch_uid="create_first_user", weak=False)

post_syncdb.connect(create_first_user, dispatch_uid="create_first_user.syncdb", weak=False)
