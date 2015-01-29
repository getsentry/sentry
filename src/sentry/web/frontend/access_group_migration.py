from __future__ import absolute_import

from collections import defaultdict

from sentry.models import (
    AccessGroup, OrganizationMember, OrganizationMemberType, Team
)
from sentry.web.frontend.base import OrganizationView


class AccessGroupMigrationView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def process_posted_member(self, request, organization, member):
        global_access = request.POST.get('user[%s][global_access]' % member.user_id)
        teams = request.POST.getlist('user[%s][team]' % member.user_id)
        remove = request.POST.get('user[%s][remove]' % member.user_id)
        access_type = request.POST.get('user[%s][type]' % member.user_id)

        if not access_type:
            return

        if remove != '1':
            if access_type == 'member':
                access_type = OrganizationMemberType.MEMBER
            elif access_type == 'admin':
                access_type = OrganizationMemberType.ADMIN
            else:
                return

            global_access = global_access == '1'

            om, created = OrganizationMember.objects.get_or_create(
                organization=organization,
                user=member.user,
                defaults={
                    'has_global_access': global_access,
                    'type': access_type,
                }
            )

            if created and not global_access:
                for team in teams:
                    om.teams.add(Team.objects.get_from_cache(slug=team))

        member.delete()

    def handle(self, request, organization):
        member_list = list(AccessGroup.members.through.objects.filter(
            accessgroup__team__organization=organization,
        ).select_related('user', 'accessgroup', 'accessgroup__team'))

        if not member_list:
            # Fix an issue where empty groups would show up
            AccessGroup.objects.filter(
                team__organization=organization,
            ).delete()

        if request.method == 'POST':
            for member in member_list:
                self.process_posted_member(request, organization, member)

            for ag in AccessGroup.objects.filter(team__organization=organization):
                if not ag.members.exists():
                    ag.delete()

            return self.redirect(request.path)

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
