from __future__ import absolute_import

import six
from collections import defaultdict

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import OrganizationMember, OrganizationMemberTeam, Team, TeamStatus


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        users = {d["id"]: d for d in serialize(set(i.user for i in item_list if i.user_id), user)}

        return {
            item: {"user": users[six.text_type(item.user_id)] if item.user_id else None}
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        d = {
            "id": six.text_type(obj.id),
            "email": obj.get_email(),
            "name": obj.user.get_display_name() if obj.user else obj.get_email(),
            "user": attrs["user"],
            "role": obj.role,
            "roleName": roles.get(obj.role).name,
            "pending": obj.is_pending,
            "expired": obj.token_expired,
            "flags": {
                "sso:linked": bool(getattr(obj.flags, "sso:linked")),
                "sso:invalid": bool(getattr(obj.flags, "sso:invalid")),
            },
            "dateCreated": obj.date_added,
            "inviteStatus": obj.get_invite_status_name(),
            "inviterName": obj.inviter.get_display_name() if obj.inviter else None,
        }
        return d


class OrganizationMemberWithTeamsSerializer(OrganizationMemberSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(OrganizationMemberWithTeamsSerializer, self).get_attrs(item_list, user)

        member_team_map = list(
            OrganizationMemberTeam.objects.filter(
                team__status=TeamStatus.VISIBLE, organizationmember__in=item_list
            ).values_list("organizationmember_id", "team_id")
        )

        teams = {
            team.id: team
            for team in Team.objects.filter(id__in=[team_id for _, team_id in member_team_map])
        }
        results = defaultdict(list)

        # results is a map of member id -> team_slug[]
        for member_id, team_id in member_team_map:
            results[member_id].append(teams[team_id].slug)

        for item in item_list:
            teams = results.get(item.id, [])
            try:
                attrs[item]["teams"] = teams
            except KeyError:
                attrs[item] = {"teams": teams}

        return attrs

    def serialize(self, obj, attrs, user):
        d = super(OrganizationMemberWithTeamsSerializer, self).serialize(obj, attrs, user)

        d["teams"] = attrs.get("teams", [])

        return d


class OrganizationMemberWithProjectsSerializer(OrganizationMemberSerializer):
    def __init__(self, *args, **kwargs):
        self.project_ids = set(kwargs.pop("project_ids", []))
        super(OrganizationMemberWithProjectsSerializer, self).__init__(*args, **kwargs)

    def get_attrs(self, item_list, user):
        attrs = super(OrganizationMemberWithProjectsSerializer, self).get_attrs(item_list, user)
        # Note: For this to be efficient, call
        # `.prefetch_related(
        #       'teams',
        #       'teams__projectteam_set',
        #       'teams__projectteam_set__project',
        # )` on your queryset before using this serializer
        for org_member in item_list:
            projects = set()
            for team in org_member.teams.all():
                # Filter in python here so that we don't break the prefetch
                if team.status != TeamStatus.VISIBLE:
                    continue

                for project_team in team.projectteam_set.all():
                    if (
                        project_team.project_id in self.project_ids
                        and project_team.project.status == TeamStatus.VISIBLE
                    ):
                        projects.add(project_team.project.slug)

            projects = list(projects)
            projects.sort()
            attrs[org_member]["projects"] = projects

        return attrs

    def serialize(self, obj, attrs, user):
        d = super(OrganizationMemberWithProjectsSerializer, self).serialize(obj, attrs, user)
        d["projects"] = attrs.get("projects", [])
        return d
