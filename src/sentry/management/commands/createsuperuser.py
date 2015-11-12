from __future__ import absolute_import, print_function

from django.core.management import call_command
from django.contrib.auth.management.commands.createsuperuser import Command


class Command(Command):
    help = 'Performs any pending database migrations and upgrades'

    def handle(self, **options):
        call_command(
            'createuser',
            is_superuser=True,
            **options
        )
