from collections import defaultdict

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import ExternalUser, OrganizationMember, OrganizationMemberTeam, Team, TeamStatus


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def __init__(
        self,
        expand=None,
    ):
        self.expand = expand or []

    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        users = {d["id"]: d for d in serialize({i.user for i in item_list if i.user_id}, user)}
        external_users_map = defaultdict(list)

        if "externalUsers" in self.expand:
            external_users = list(ExternalUser.objects.filter(organizationmember__in=item_list))

            for external_user in external_users:
                serialized = serialize(external_user, user)
                external_users_map[external_user.organizationmember_id].append(serialized)

        attrs = {
            item: {
                "user": users[str(item.user_id)] if item.user_id else None,
                "externalUsers": external_users_map[item.id],
            }
            for item in item_list
        }

        return attrs

    def serialize(self, obj, attrs, user):
        d = {
            "id": str(obj.id),
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

        if "externalUsers" in self.expand:
            d["externalUsers"] = attrs.get("externalUsers", [])

        return d


class OrganizationMemberWithTeamsSerializer(OrganizationMemberSerializer):
    def get_attrs(self, item_list, user):
        attrs = super().get_attrs(item_list, user)

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
        d = super().serialize(obj, attrs, user)

        d["teams"] = attrs.get("teams", [])

        return d


class OrganizationMemberWithProjectsSerializer(OrganizationMemberSerializer):
    def __init__(self, *args, **kwargs):
        self.project_ids = set(kwargs.pop("project_ids", []))
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user):
        attrs = super().get_attrs(item_list, user)
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
        d = super().serialize(obj, attrs, user)
        d["projects"] = attrs.get("projects", [])
        return d
