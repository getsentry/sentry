from collections.abc import Mapping, Sequence
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.organization_member.response import OrganizationMemberResponse
from sentry.api.serializers.models.team import TeamSerializerResponse
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class OrganizationAccessRequestSerializerResponse(TypedDict):
    id: str
    member: OrganizationMemberResponse | None
    team: TeamSerializerResponse | None
    requester: UserSerializerResponse | None


@register(OrganizationAccessRequest)
class OrganizationAccessRequestSerializer(Serializer[OrganizationAccessRequestSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[OrganizationAccessRequest],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[OrganizationAccessRequest, dict[str, object]]:
        serialized_requesters = user_service.serialize_many(
            filter=dict(user_ids=[item.requester_id for item in item_list if item.requester_id])
        )

        serialized_requesters_by_id = {
            int(requester["id"]): requester for requester in serialized_requesters
        }

        serialized_members = serialize(
            [item.member for item in item_list],
            user,
        )

        serialized_members_by_id = {int(member["id"]): member for member in serialized_members}

        serialized_teams = serialize([item.team for item in item_list], user)

        serialized_teams_by_id = {int(team["id"]): team for team in serialized_teams}

        return {
            item: {
                "requester": serialized_requesters_by_id.get(item.requester_id)
                if item.requester_id is not None
                else None,
                "member": serialized_members_by_id.get(item.member_id),
                "team": serialized_teams_by_id.get(item.team_id),
            }
            for item in item_list
        }

    def serialize(
        self,
        obj: OrganizationAccessRequest,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> OrganizationAccessRequestSerializerResponse:
        serialized_access_request: OrganizationAccessRequestSerializerResponse = {
            "id": str(obj.id),
            "member": cast(OrganizationMemberResponse | None, attrs["member"]),
            "team": cast(TeamSerializerResponse | None, attrs["team"]),
            "requester": cast(UserSerializerResponse | None, attrs["requester"]),
        }
        return serialized_access_request
