"""
sentry.management.commands.repair
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Attempts to repair any invalid data within Sentry'

    def handle(self, **options):
        print("Forcing documentation sync")
        from sentry.tasks.sync_docs import sync_docs
        sync_docs()

        from sentry.models import Project, ProjectKey
        from sentry.utils.query import RangeQuerySetWrapperWithProgressBar
        print("Creating missing project keys")
        queryset = Project.objects.all()
        for project in RangeQuerySetWrapperWithProgressBar(queryset):
            try:
                ProjectKey.objects.get_or_create(
                    project=project,
                )
            except ProjectKey.MultipleObjectsReturned:
                pass
