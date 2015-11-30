"""
sentry.management.commands.repair
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Attempts to repair any invalid data within Sentry'

    def handle(self, **options):
        print("Forcing documentation sync")
        from sentry.tasks.sync_docs import sync_docs
        sync_docs()

        from sentry.models import Activity, Project, ProjectKey
        print("Creating missing project keys")
        queryset = Project.objects.filter(key_set__isnull=True)
        for project in queryset:
            try:
                ProjectKey.objects.get_or_create(
                    project=project,
                )
            except ProjectKey.MultipleObjectsReturned:
                pass

        print("Correcting Group.num_comments counter")
        cursor = connection.cursor()
        cursor.execute("""
            UPDATE sentry_groupedmessage SET num_comments = (
                SELECT COUNT(*) from sentry_activity
                WHERE type = %s and group_id = sentry_groupedmessage.id
            )
        """, [Activity.NOTE])
