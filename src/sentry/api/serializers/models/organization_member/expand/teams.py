from typing import Any, Mapping, MutableMapping, Sequence, cast

from sentry.models import OrganizationMember, User

from ..base import OrganizationMemberSerializer
from ..response import OrganizationMemberWithTeamsResponse
from ..utils import get_team_slugs_by_organization_member_id


class OrganizationMemberWithTeamsSerializer(OrganizationMemberSerializer):
    def get_attrs(
        self, item_list: Sequence[OrganizationMember], user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        team_ids_by_organization_member_id = get_team_slugs_by_organization_member_id(item_list)
        for item in item_list:
            teams = team_ids_by_organization_member_id.get(item.id, [])
            try:
                attrs[item]["teams"] = teams
            except KeyError:
                attrs[item] = {"teams": teams}

        return attrs

    def serialize(
        self, obj: OrganizationMember, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> OrganizationMemberWithTeamsResponse:
        d = cast(OrganizationMemberWithTeamsResponse, super().serialize(obj, attrs, user))
        d["teams"] = attrs.get("teams", [])
        return d
