from collections import defaultdict
from typing import Any, Mapping, MutableMapping, Optional, Sequence

from django.db.models import prefetch_related_objects

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.role import OrganizationRoleSerializer
from sentry.models import ExternalActor, OrganizationMember, User
from sentry.services.hybrid_cloud.user import user_service

from .response import OrganizationMemberResponse
from .utils import get_organization_id


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):  # type: ignore
    def __init__(self, expand: Optional[Sequence[str]] = None) -> None:
        self.expand = expand or []

    def get_attrs(
        self, item_list: Sequence[OrganizationMember], user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        """
        Fetch all of the associated Users and ExternalActors needed to serialize
        the organization_members in `item_list`.
        TODO(dcramer): assert on relations
        """

        # Preload to avoid fetching each user individually
        prefetch_related_objects(item_list, "user", "inviter")
        users_set = sorted(
            {
                organization_member.user_id
                for organization_member in item_list
                if organization_member.user_id
            }
        )
        users_by_id: Mapping[str, Any] = {
            u["id"]: u for u in user_service.serialize_many(filter={"user_ids": users_set})
        }
        actor_ids = [u.actor_id for u in user_service.get_many(filter={"user_ids": users_set})]
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
            external_users = external_users_map.get(user_id, [])
            attrs[item] = {
                "user": user,
                "externalUsers": external_users,
            }
        return attrs

    def serialize(
        self, obj: OrganizationMember, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> OrganizationMemberResponse:
        d: OrganizationMemberResponse = {
            "id": str(obj.id),
            "email": obj.get_email(),
            "name": obj.user.get_display_name() if obj.user else obj.get_email(),
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
            "inviterName": obj.inviter.get_display_name() if obj.inviter else None,
            "orgRolesFromTeams": [
                {
                    "slug": slug,
                    "role": serialize(
                        role, serializer=OrganizationRoleSerializer(organization=obj.organization)
                    ),
                }
                for slug, role in obj.get_org_roles_from_teams_by_source()
            ],
        }

        if "externalUsers" in self.expand:
            d["externalUsers"] = attrs.get("externalUsers", [])

        return d
