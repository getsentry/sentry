from __future__ import absolute_import

from collections import defaultdict

from sentry.models import AccessGroup, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class AccessGroupMigrationView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        member_list = list(AccessGroup.members.through.objects.filter(
            accessgroup__team__organization=organization,
        ).select_related('user', 'accessgroup', 'accessgroup__team'))

        group_list = set(m.accessgroup for m in member_list)

        team_list = organization.team_set.all()

        project_list = list(AccessGroup.projects.through.objects.filter(
            accessgroup__in=group_list,
        ).select_related('project', 'project__team'))

        # sort projects by group
        projects_by_group = defaultdict(list)
        for obj in project_list:
            projects_by_group[obj.accessgroup_id].append(obj.project)

        projects_by_user = defaultdict(list)
        for member in member_list:
            projects_by_user[member.user_id].extend(projects_by_group[member.accessgroup_id])

        results = []
        for member in member_list:
            results.append((
                member.user,
                projects_by_user[member.user_id],
            ))

        context = {
            'member_list': results,
            'group_list': group_list,
            'team_list': team_list,
        }

        return self.respond('sentry/access-group-migration.html', context)
