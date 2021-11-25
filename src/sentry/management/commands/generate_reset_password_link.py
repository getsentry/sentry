import sys

from click import echo
from django.core.management.base import BaseCommand

from sentry.models import LostPasswordHash
from sentry.utils.auth import find_users


class Command(BaseCommand):
    help = "Generate a link for a user to reset their password"

    def add_arguments(self, parser):
        parser.add_argument(
            "--noinput",
            dest="noinput",
            action="store_true",
            default=False,
            help="Dont ask for confirmation before merging accounts.",
        )

    def handle(self, username, **options):
        users = find_users(username, with_valid_password=False)
        if not users:
            sys.stdout.write("No account found with given username.\n")
            return

        for user in users:
            password_hash = LostPasswordHash.objects.for_user(user)
            echo(f"{user.username} ({user.email}) - {password_hash.get_absolute_url()}")
