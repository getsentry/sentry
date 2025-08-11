from sentry.api.serializers import Serializer, register, serialize
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.users.services.user.service import user_service


@register(OrganizationAccessRequest)
class OrganizationAccessRequestSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):

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
                "requester": serialized_requesters_by_id.get(item.requester_id),
                "member": serialized_members_by_id.get(item.member_id),
                "team": serialized_teams_by_id.get(item.team_id),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs):
        serialized_access_request = {
            "id": str(obj.id),
            "member": attrs["member"],
            "team": attrs["team"],
            "requester": attrs["requester"],
        }
        return serialized_access_request
