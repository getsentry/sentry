from collections.abc import Mapping, MutableMapping, Sequence
from typing import int, Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.organizationmemberinvite import (
    OrganizationMemberInvite,
    OrganizationMemberInviteResponse,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


@register(OrganizationMemberInvite)
class OrganizationMemberInviteSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[OrganizationMemberInvite],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[OrganizationMemberInvite, MutableMapping[str, Any]]:
        inviters_set = sorted({omi.inviter_id for omi in item_list if omi.inviter_id})
        inviters_by_id: Mapping[int, RpcUser] = {
            u.id: u for u in user_service.get_many_by_id(ids=inviters_set)
        }
        attrs: MutableMapping[OrganizationMemberInvite, MutableMapping[str, Any]] = {}
        for item in item_list:
            if item.inviter_id is not None:
                inviter = inviters_by_id.get(item.inviter_id, None)
            else:
                inviter = None
            attrs[item] = {"inviter": inviter}
        return attrs

    def serialize(
        self,
        obj: OrganizationMemberInvite,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationMemberInviteResponse:
        inviter_name = None
        if obj.inviter_id:
            inviter = attrs["inviter"]
            if inviter:
                inviter_name = inviter.get_display_name()

        data: OrganizationMemberInviteResponse = {
            "id": str(obj.id),
            "email": obj.email,
            "orgRole": obj.role,
            "expired": obj.token_expired,
            "idpProvisioned": obj.idp_provisioned,
            "idpRoleRestricted": obj.idp_role_restricted,
            "ssoLinked": obj.sso_linked,
            "ssoInvalid": obj.sso_invalid,
            "memberLimitRestricted": obj.member_limit_restricted,
            "partnershipRestricted": obj.partnership_restricted,
            "teams": obj.organization_member_team_data,
            "dateCreated": obj.date_added,
            "inviteStatus": obj.get_invite_status_name(),
            "inviterName": inviter_name,
        }

        return data
