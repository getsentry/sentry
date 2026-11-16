import logging
import sys

from django.conf import settings

from sentry.signals import post_upgrade
from sentry.silo.base import SiloMode
from sentry.users.models.user import User
from sentry.utils.env import in_test_environment
from sentry.utils.settings import is_self_hosted

audit_logger = logging.getLogger("sentry.audit.user")

DEV_ADMIN_EMAIL = "admin@sentry.io"


def create_dev_admin(**kwargs: object) -> None:
    # A superuser with a well-known password is only for local dev, which `sentry init --dev`
    # marks with DEBUG = True.
    if not settings.DEBUG or in_test_environment():
        return

    if User.objects.filter(username=DEV_ADMIN_EMAIL).exists():
        return

    from sentry.runner import call_command

    call_command(
        "sentry.runner.commands.createuser.createuser",
        emails=[DEV_ADMIN_EMAIL],
        password="admin",
        superuser=True,
        no_input=True,
    )
    audit_logger.info(
        "user.create-dev-admin",
        extra={
            "actor": "post_upgrade",
            "user_id": User.objects.get(username=DEV_ADMIN_EMAIL).id,
        },
    )


def create_first_user(**kwargs: object) -> None:
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


# Before create_first_user, so a dev install never prompts for one.
post_upgrade.connect(
    create_dev_admin, dispatch_uid="create_dev_admin", weak=False, sender=SiloMode.MONOLITH
)
post_upgrade.connect(
    create_first_user, dispatch_uid="create_first_user", weak=False, sender=SiloMode.MONOLITH
)
