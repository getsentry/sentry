from collections import defaultdict
from typing import Any, Mapping, MutableMapping, Optional, Sequence

from django.db.models import Prefetch, prefetch_related_objects

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.role import OrganizationRoleSerializer
from sentry.models import ExternalActor, OrganizationMember, User
from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.team import Team
from sentry.roles import organization_roles
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service

from .response import OrganizationMemberResponse
from .utils import get_organization_id


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):  # type: ignore
    def __init__(self, expand: Optional[Sequence[str]] = None) -> None:
        self.expand = expand or []

    def __sorted_org_roles_for_user(self, item: OrganizationMember) -> Sequence[Mapping[str, Any]]:
        org_roles = [
            (team.slug, organization_roles.get(team.org_role)) for team in item.team_role_prefetch
        ]

        sorted_org_roles = sorted(
            org_roles,
            key=lambda r: r[1].priority,  # type: ignore[no-any-return]
            reverse=True,
        )

        return [
            {
                "teamSlug": slug,
                "role": serialize(
                    role,
                    serializer=OrganizationRoleSerializer(organization=item.organization),
                ),
            }
            for slug, role in sorted_org_roles
        ]

    def get_attrs(
        self, item_list: Sequence[OrganizationMember], user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        """
        Fetch all of the associated Users and ExternalActors needed to serialize
        the organization_members in `item_list`.
        TODO(dcramer): assert on relations
        """

        # Preload to avoid fetching each team individually
        prefetch_related_objects(
            item_list,
            Prefetch(
                "teams",
                queryset=Team.objects.all().exclude(org_role=None),
                to_attr="team_role_prefetch",
            ),
        )

        # Bulk load users
        users_set = sorted(
            {
                organization_member.user_id
                for organization_member in item_list
                if organization_member.user_id
            }
        )
        users_by_id: MutableMapping[str, Any] = {}
        email_map: MutableMapping[str, str] = {}
        for u in user_service.serialize_many(filter={"user_ids": users_set}):
            users_by_id[u["id"]] = u
            email_map[u["id"]] = u["email"]

        actor_ids = Actor.objects.filter(
            user_id__in=users_set, type=ACTOR_TYPES["user"]
        ).values_list("id", flat=True)

        inviters_set = sorted(
            {
                organization_member.inviter_id
                for organization_member in item_list
                if organization_member.inviter_id
            }
        )
        inviters_by_id: Mapping[int, RpcUser] = {
            u.id: u for u in user_service.get_many(filter={"user_ids": inviters_set})
        }

        external_users_map = defaultdict(list)
        if "externalUsers" in self.expand:
            organization_id = get_organization_id(item_list)
            external_actors = list(
                ExternalActor.objects.filter(
                    actor_id__in=actor_ids,
                    organization_id=organization_id,
                )
            )

            serialized_list = serialize(external_actors, user, key="user")
            for serialized in serialized_list:
                external_users_map[serialized["userId"]].append(serialized)

        attrs: MutableMapping[OrganizationMember, MutableMapping[str, Any]] = {}
        for item in item_list:
            user = users_by_id.get(str(item.user_id), None)
            user_id = user["id"] if user else ""
            inviter = inviters_by_id.get(item.inviter_id, None)
            external_users = external_users_map.get(user_id, [])
            attrs[item] = {
                "user": user,
                "externalUsers": external_users,
                "orgRolesFromTeams": self.__sorted_org_roles_for_user(item),
                "inviter": inviter,
                "email": email_map.get(user_id, item.email),
            }
        return attrs

    def serialize(
        self, obj: OrganizationMember, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> OrganizationMemberResponse:
        inviter_name = None
        if obj.inviter_id:
            inviter = attrs["inviter"]
            if inviter:
                inviter_name = inviter.get_display_name()
        user = attrs["user"]
        email = attrs["email"]
        d: OrganizationMemberResponse = {
            "id": str(obj.id),
            "email": email,
            "name": user["name"] if user else email,
            "user": attrs["user"],
            "role": obj.role,  # Deprecated, use orgRole instead
            "roleName": roles.get(obj.role).name,  # Deprecated
            "orgRole": obj.role,
            "pending": obj.is_pending,
            "expired": obj.token_expired,
            "flags": {
                "idp:provisioned": bool(getattr(obj.flags, "idp:provisioned")),
                "idp:role-restricted": bool(getattr(obj.flags, "idp:role-restricted")),
                "sso:linked": bool(getattr(obj.flags, "sso:linked")),
                "sso:invalid": bool(getattr(obj.flags, "sso:invalid")),
                "member-limit:restricted": bool(getattr(obj.flags, "member-limit:restricted")),
            },
            "dateCreated": obj.date_added,
            "inviteStatus": obj.get_invite_status_name(),
            "inviterName": inviter_name,
            "orgRolesFromTeams": attrs.get("orgRolesFromTeams", []),
        }

        if "externalUsers" in self.expand:
            d["externalUsers"] = attrs.get("externalUsers", [])

        return d
