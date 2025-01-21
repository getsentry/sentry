from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organizationmember import OrganizationMember
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

from .response import OrganizationMemberResponse
from .utils import get_organization_id


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def __init__(self, expand: Sequence[str] | None = None) -> None:
        self.expand = expand or []

    def get_attrs(
        self,
        item_list: Sequence[OrganizationMember],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        """
        Fetch all of the associated Users and ExternalActors needed to serialize
        the organization_members in `item_list`.
        TODO(dcramer): assert on relations
        """

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
            # Filter out the emails from the user data
            u.pop("emails", None)
            users_by_id[u["id"]] = u
            email_map[u["id"]] = u["email"]

        inviters_set = sorted(
            {
                organization_member.inviter_id
                for organization_member in item_list
                if organization_member.inviter_id
            }
        )
        inviters_by_id: Mapping[int, RpcUser] = {
            u.id: u for u in user_service.get_many_by_id(ids=inviters_set)
        }

        external_users_map = defaultdict(list)
        if "externalUsers" in self.expand:
            organization_id = get_organization_id(item_list)
            external_actors = list(
                ExternalActor.objects.filter(
                    user_id__in=users_set,
                    organization_id=organization_id,
                )
            )

            serialized_list = serialize(external_actors, user, key="user")
            for serialized in serialized_list:
                external_users_map[serialized["userId"]].append(serialized)

        attrs: MutableMapping[OrganizationMember, MutableMapping[str, Any]] = {}
        for item in item_list:
            user_dct = users_by_id.get(str(item.user_id), None)
            user_id = user_dct["id"] if user_dct else ""
            if item.inviter_id is not None:
                inviter = inviters_by_id.get(item.inviter_id, None)
            else:
                inviter = None
            external_users = external_users_map.get(user_id, [])
            attrs[item] = {
                "user": user_dct,
                "externalUsers": external_users,
                "inviter": inviter,
                "email": email_map.get(user_id, item.email),
            }
        return attrs

    def serialize(
        self,
        obj: OrganizationMember,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationMemberResponse:
        serialized_user = attrs["user"]
        if obj.user_id:
            # if the OrganizationMember has a user_id, the user has an account
            # `email` on the OrganizationMember will be null, so we need to pull
            # the email address from the user's actual account
            email = serialized_user["email"] if serialized_user else obj.email
        else:
            # when there is no user_id, the OrganizationMember is an invited user
            # and the email field on OrganizationMember will be populated, so we
            # will use it directly
            email = obj.email

        # helping mypy - the email will always be populated at this point
        # in the case that it is a user that has an account, we pull the email
        # address above from the serialized_user. The email field on OrganizationMember
        # is null in the case, so it is necessary.
        #
        # invited users do not yet have a full account and the email field
        # on OrganizationMember will be populated in such cases
        assert email is not None

        inviter_name = None
        if obj.inviter_id:
            inviter = attrs["inviter"]
            if inviter:
                inviter_name = inviter.get_display_name()

        name = serialized_user["name"] if serialized_user else email

        data: OrganizationMemberResponse = {
            "id": str(obj.id),
            "email": email,
            "name": name,
            "user": attrs["user"],
            "orgRole": obj.role,
            "pending": obj.is_pending,
            "expired": obj.token_expired,
            "flags": {
                "idp:provisioned": bool(getattr(obj.flags, "idp:provisioned")),
                "idp:role-restricted": bool(getattr(obj.flags, "idp:role-restricted")),
                "sso:linked": bool(getattr(obj.flags, "sso:linked")),
                "sso:invalid": bool(getattr(obj.flags, "sso:invalid")),
                "member-limit:restricted": bool(getattr(obj.flags, "member-limit:restricted")),
                "partnership:restricted": bool(getattr(obj.flags, "partnership:restricted")),
            },
            "dateCreated": obj.date_added,
            "inviteStatus": obj.get_invite_status_name(),
            "inviterName": inviter_name,
            "role": obj.role,  # Deprecated, use orgRole instead
            "roleName": roles.get(obj.role).name,  # Deprecated
        }

        if "externalUsers" in self.expand:
            data["externalUsers"] = attrs.get("externalUsers", [])

        return data
