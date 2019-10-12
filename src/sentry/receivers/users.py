from __future__ import absolute_import, print_function

from django.db import router
from django.db.models.signals import post_migrate


def create_first_user(app_config, using, interactive, **kwargs):
    if app_config and app_config.name != "sentry":
        return

    try:
        User = app_config.get_model("User")
    except LookupError:
        return

    if User.objects.filter(is_superuser=True).exists():
        return

    if hasattr(router, "allow_migrate"):
        if not router.allow_migrate(using, User):
            return
    else:
        if not router.allow_syncdb(using, User):
            return
    if not interactive:
        return

    import click

    if not click.confirm("\nWould you like to create a user account now?", default=True):
        # Not using `abort=1` because we don't want to exit out from further execution
        click.echo("\nRun `sentry createuser` to do this later.\n")
        return

    from sentry.runner import call_command

    call_command("sentry.runner.commands.createuser.createuser", superuser=True)


post_migrate.connect(create_first_user, dispatch_uid="create_first_user", weak=False)
