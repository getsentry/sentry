from __future__ import annotations

from typing import Any, Mapping, Sequence

from django.db.models import Q
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
from sentry.models.team import Team
from sentry.services.hybrid_cloud.user.model import RpcUser
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

    def get_option_groups(
        self, organization_id: int, substring: str
    ) -> Sequence[Mapping[str, Any]]:
        filtered_teams = Team.objects.filter(
            Q(name__startswith=substring) | Q(slug__startswith=substring),
            organization_id=organization_id,
        )
        all_members = OrganizationMember.objects.filter(organization_id=organization_id)
        all_members_as_rpc_users = [RpcUser(id=member.id) for member in all_members]
        filtered_members = filter(
            lambda member: any(
                member.display_name.startswith(substring),
                member.name.startswith(substring),
                member.email.startswith(substring),
                member.username.startswith(substring),
            ),
            all_members_as_rpc_users,
        )

        option_groups = []

        if filtered_teams:
            team_options = format_actor_options(filtered_teams, True)
            option_groups.append(
                {"label": {"type": "plain_text", "text": "Teams"}, "options": team_options}
            )

        if filtered_members:
            member_options = format_actor_options(filtered_members, True)
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

        payload = {
            "option_groups": self.get_option_groups(
                group.project.organization.id, slack_request.substring
            )
        }

        return self.respond(payload)
