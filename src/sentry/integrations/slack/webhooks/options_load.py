from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

import orjson
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.messaging.message_builder import format_actor_options_slack
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.options_load import SlackOptionsLoadRequest
from sentry.models.group import Group

_logger = logging.getLogger(__name__)


class OptionGroup(TypedDict):
    label: Mapping[str, str]
    options: Sequence[Mapping[str, Any]]


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
        # in case either have special characters, we want to preserve the strings
        # as is, so we escape both before applying re.match
        substring = re.escape(substring)
        return bool(re.match(substring, string, re.I))

    def get_filtered_option_groups(self, group: Group, substring: str) -> list[OptionGroup]:
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

        option_groups: list[OptionGroup] = []
        if filtered_teams:
            team_options_group: OptionGroup = {
                "label": {"type": "plain_text", "text": "Teams"},
                "options": format_actor_options_slack(filtered_teams),
            }
            option_groups.append(team_options_group)
        if filtered_members:
            member_options_group: OptionGroup = {
                "label": {"type": "plain_text", "text": "People"},
                "options": format_actor_options_slack(filtered_members),
            }
            option_groups.append(member_options_group)
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

        if not group:
            _logger.error(
                "slack.options_load.request-error",
                extra={
                    "group_id": slack_request.group_id,
                    "request_data": orjson.dumps(slack_request.data).decode(),
                },
            )
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        payload = {"option_groups": self.get_filtered_option_groups(group, slack_request.substring)}

        return self.respond(payload)
