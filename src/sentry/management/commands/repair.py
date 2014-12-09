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
        from sentry.constants import RESERVED_ORGANIZATION_SLUGS
        from sentry.models import Organization, Project, Team, ProjectKey
        from sentry.db.models import update
        from sentry.db.models.utils import slugify_instance

        print("Creating missing slugs for organizations")
        for org in Organization.objects.filter(slug__isnull=True):
            org.slug = slugify_instance(org, org.name, RESERVED_ORGANIZATION_SLUGS)
            print('Assigning slug %r for %s' % (org.slug, org.id))
            org.save()

        # Create teams for any projects that are missing them
        print("Creating missing teams on projects")
        for project in Project.objects.filter(team__isnull=True):
            # TODO(dcramer): this needs owners
            team = Team(
                name=project.name,
                owner=project.owner,
            )
            team.slug = slugify_instance(team, team.name, RESERVED_ORGANIZATION_SLUGS)
            team.save()

            update(project, team=team)
            print("* Created team %s for %s" % (team, project))

        # Create missing project keys
        print("Creating missing project keys")
        for team in Team.objects.all():
            for member in team.member_set.select_related('user'):
                for project in team.project_set.all():
                    try:
                        created = ProjectKey.objects.get_or_create(
                            project=project,
                            user=member.user,
                        )[1]
                    except ProjectKey.MultipleObjectsReturned:
                        pass
                    else:
                        if created:
                            print("* Created key for %s on %s" % (member.user.username, project))
