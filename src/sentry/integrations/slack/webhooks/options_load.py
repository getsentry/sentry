from __future__ import annotations

from typing import Any, Mapping, Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.message_builder import format_actor_options
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.options_load import SlackOptionsLoadRequest
from sentry.models.group import Group
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class SlackOptionsLoadEndpoint(Endpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackOptionsLoadRequest

    def get_option_groups(self, organization_id: int) -> Sequence[Mapping[str, Any]]:
        teams = OrganizationMemberTeamReplica.objects.get(organization_id=organization_id)
        members = OrganizationMember.objects.get(organization_id=organization_id)

        option_groups = []

        if teams:
            team_options = format_actor_options(teams, True)
            option_groups.append(
                {"label": {"type": "plain_text", "text": "Teams"}, "options": team_options}
            )

        if members:
            member_options = format_actor_options(members, True)
            option_groups.append(
                {"label": {"type": "plain_text", "text": "People"}, "options": member_options}
            )

        return option_groups

    @transaction_start("SlackOptionsLoadEndpoint")
    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        group = (
            Group.objects.select_related("project__organization")
            .filter(id=slack_request.group_id)
            .first()
        )

        payload = {"option_groups": self.get_option_groups(group.project.organization.id)}

        return self.respond(payload)
