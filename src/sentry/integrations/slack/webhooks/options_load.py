from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.message_builder import format_actor_options
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.options_load import SlackOptionsLoadRequest
from sentry.models.group import Group
from sentry.utils import json

from ..utils import logger


@region_silo_endpoint
class SlackOptionsLoadEndpoint(Endpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackOptionsLoadRequest

    def is_substring(self, string, substring):
        return bool(re.match(substring, string, re.I))

    def get_filtered_option_groups(
        self, group: Group, substring: str
    ) -> Sequence[Mapping[str, Any]]:
        all_teams = group.project.teams.all()
        filtered_teams = list(
            filter(
                lambda team: any(
                    [
                        self.is_substring(team.name, substring),
                        self.is_substring(team.slug, substring),
                    ]
                ),
                all_teams,
            )
        )
        all_members = group.project.get_members_as_rpc_users()
        filtered_members = list(
            filter(
                lambda member: any(
                    [
                        self.is_substring(member.display_name, substring),
                        self.is_substring(member.name, substring),
                        self.is_substring(member.email, substring),
                        self.is_substring(member.username, substring),
                    ]
                ),
                all_members,
            )
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

    # XXX(isabella): atm this endpoint is used only for the assignment dropdown on issue alerts
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

        if not group or not features.has(
            "organizations:slack-block-kit", group.project.organization
        ):
            logger.exception(
                "slack.options_load.request-error",
                extra={
                    "group_id": group.id if group else None,
                    "organization_id": group.project.organization.id if group else None,
                    "request_data": json.dumps_experimental(
                        "integrations.slack.enable-orjson", slack_request.data
                    ),
                },
            )
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        payload = {"option_groups": self.get_filtered_option_groups(group, slack_request.substring)}

        return self.respond(payload)
