import sys

from sentry.models.user import User
from sentry.signals import post_upgrade
from sentry.silo import SiloMode
from sentry.utils.settings import is_self_hosted


def create_first_user(**kwargs):
    if User.objects.filter(is_superuser=True).exists():
        return

    if not sys.stdin.isatty() and not is_self_hosted():
        return

    if not kwargs["interactive"]:
        return

    import click

    if not click.confirm("\nWould you like to create a user account now?", default=True):
        # Not using `abort=1` because we don't want to exit out from further execution
        click.echo("\nRun `sentry createuser` to do this later.\n")
        return

    from sentry.runner import call_command

    call_command("sentry.runner.commands.createuser.createuser", superuser=True)


post_upgrade.connect(
    create_first_user, dispatch_uid="create_first_user", weak=False, sender=SiloMode.MONOLITH
)
