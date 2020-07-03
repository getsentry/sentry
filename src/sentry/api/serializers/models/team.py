from __future__ import absolute_import

import six

from collections import defaultdict
from django.db.models import Count


from sentry import roles
from sentry.app import env
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    InviteStatus,
    OrganizationAccessRequest,
    OrganizationMember,
    OrganizationMemberTeam,
    ProjectStatus,
    ProjectTeam,
    Team,
    TeamAvatar,
)
from sentry.utils.compat import zip


def get_team_memberships(team_list, user):
    """Get memberships the user has in the provided team list"""
    if user.is_authenticated():
        return OrganizationMemberTeam.objects.filter(
            organizationmember__user=user, team__in=team_list
        ).values_list("team", flat=True)
    return []


def get_member_totals(team_list, user):
    """Get the total number of members in each team"""
    if user.is_authenticated():
        query = (
            Team.objects.filter(
                id__in=[t.pk for t in team_list],
                organizationmember__invite_status=InviteStatus.APPROVED.value,
            )
            .annotate(member_count=Count("organizationmemberteam"))
            .values("id", "member_count")
        )
        return {item["id"]: item["member_count"] for item in query}
    return {}


def get_org_roles(org_ids, user):
    """Get the role the user has in each org"""
    if user.is_authenticated():
        # map of org id to role
        return {
            om["organization_id"]: om["role"]
            for om in OrganizationMember.objects.filter(
                user=user, organization__in=set(org_ids)
            ).values("role", "organization_id")
        }
    return {}


def get_access_requests(item_list, user):
    if user.is_authenticated():
        return frozenset(
            OrganizationAccessRequest.objects.filter(
                team__in=item_list, member__user=user
            ).values_list("team", flat=True)
        )
    return frozenset()


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        request = env.request
        org_ids = set([t.organization_id for t in item_list])

        org_roles = get_org_roles(org_ids, user)

        member_totals = get_member_totals(item_list, user)
        memberships = get_team_memberships(item_list, user)
        access_requests = get_access_requests(item_list, user)

        avatars = {a.team_id: a for a in TeamAvatar.objects.filter(team__in=item_list)}

        is_superuser = request and is_active_superuser(request) and request.user == user
        result = {}

        for team in item_list:
            is_member = team.id in memberships
            org_role = org_roles.get(team.organization_id)
            if is_member:
                has_access = True
            elif is_superuser:
                has_access = True
            elif team.organization.flags.allow_joinleave:
                has_access = True
            elif org_role and roles.get(org_role).is_global:
                has_access = True
            else:
                has_access = False
            result[team] = {
                "pending_request": team.id in access_requests,
                "is_member": is_member,
                "has_access": has_access,
                "avatar": avatars.get(team.id),
                "member_count": member_totals.get(team.id, 0),
            }
        return result

    def serialize(self, obj, attrs, user):
        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None}
        return {
            "id": six.text_type(obj.id),
            "slug": obj.slug,
            "name": obj.name,
            "dateCreated": obj.date_added,
            "isMember": attrs["is_member"],
            "hasAccess": attrs["has_access"],
            "isPending": attrs["pending_request"],
            "memberCount": attrs["member_count"],
            "avatar": avatar,
        }


class TeamWithProjectsSerializer(TeamSerializer):
    def get_attrs(self, item_list, user):
        project_teams = list(
            ProjectTeam.objects.filter(team__in=item_list, project__status=ProjectStatus.VISIBLE)
            .order_by("project__name", "project__slug")
            .select_related("project")
        )

        # TODO(dcramer): we should query in bulk for ones we're missing here
        orgs = {i.organization_id: i.organization for i in item_list}

        for project_team in project_teams:
            project_team.project._organization_cache = orgs[project_team.project.organization_id]

        projects = [pt.project for pt in project_teams]
        projects_by_id = {
            project.id: data for project, data in zip(projects, serialize(projects, user))
        }

        project_map = defaultdict(list)
        for project_team in project_teams:
            project_map[project_team.team_id].append(projects_by_id[project_team.project_id])

        result = super(TeamWithProjectsSerializer, self).get_attrs(item_list, user)
        for team in item_list:
            result[team]["projects"] = project_map[team.id]
        return result

    def serialize(self, obj, attrs, user):
        d = super(TeamWithProjectsSerializer, self).serialize(obj, attrs, user)
        d["projects"] = attrs["projects"]
        return d
