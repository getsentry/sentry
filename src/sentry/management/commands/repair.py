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
        from django.db.models import Q
        from sentry.constants import RESERVED_ORGANIZATION_SLUGS
        from sentry.models import Organization, Project, Team, ProjectKey
        from sentry.db.models import update
        from sentry.db.models.utils import slugify_instance
        from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

        print("Correcting data on organizations")
        queryset = Organization.objects.filter(
            slug__isnull=True,
        )
        for org in RangeQuerySetWrapperWithProgressBar(queryset):
            slugify_instance(org, org.name, RESERVED_ORGANIZATION_SLUGS)
            org.save()

        # Create teams for any projects that are missing them
        print("Correcting data on projects")
        queryset = Project.objects.filter(
            Q(team__isnull=True) | Q(organization__isnull=True),
        ).select_related('owner')
        for project in RangeQuerySetWrapperWithProgressBar(queryset):
            if not project.team:
                organization = Organization(
                    name=project.name,
                    owner=project.owner,
                )
                slugify_instance(organization, organization.name, RESERVED_ORGANIZATION_SLUGS)
                organization.save()

                team = Team(
                    name=project.name,
                    owner=project.owner,
                    oprganization=organization,
                )
                slugify_instance(team, team.name, RESERVED_ORGANIZATION_SLUGS)
                team.save()

            update(project, organization=team.organization, team=team)

        # Create missing project keys
        print("Creating missing project keys")
        queryset = Team.objects.all()
        for team in RangeQuerySetWrapperWithProgressBar(queryset):
            for member in team.member_set.select_related('user'):
                for project in team.project_set.all():
                    try:
                        created = ProjectKey.objects.get_or_create(
                            project=project,
                            user=member.user,
                        )[1]
                    except ProjectKey.MultipleObjectsReturned:
                        pass
