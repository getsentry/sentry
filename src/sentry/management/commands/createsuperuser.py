from __future__ import absolute_import, print_function

from django.contrib.auth.management.commands.createsuperuser import Command


class Command(Command):
    help = "Performs any pending database migrations and upgrades"

    def handle(self, **options):
        from sentry.runner import call_command

        call_command("sentry.runner.commands.createuser.createuser", superuser=True)
