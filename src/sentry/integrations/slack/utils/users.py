from __future__ import annotations

import logging
from collections.abc import Generator, Iterable, Mapping, MutableMapping
from dataclasses import dataclass
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.metrics import (
    SLACK_UTILS_GET_USER_LIST_FAILURE_DATADOG_METRIC,
    SLACK_UTILS_GET_USER_LIST_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models.user import User
from sentry.utils import metrics

_logger = logging.getLogger(__name__)

SLACK_GET_USERS_PAGE_LIMIT = 100
SLACK_GET_USERS_PAGE_SIZE = 200


@dataclass(frozen=True)
class SlackUserData:
    email: str
    team_id: str
    slack_id: str


def format_slack_info_by_email(users: list[dict[str, Any]]) -> dict[str, SlackUserData]:
    return {
        member["profile"]["email"]: SlackUserData(
            email=member["profile"]["email"], team_id=member["team_id"], slack_id=member["id"]
        )
        for member in users
        if not member["deleted"] and member["profile"].get("email")
    }


def format_slack_data_by_user(
    emails_by_user: Mapping[User, Iterable[str]], users: list[dict[str, Any]]
) -> Mapping[User, SlackUserData]:
    slack_info_by_email = format_slack_info_by_email(users)

    slack_data_by_user: MutableMapping[User, SlackUserData] = {}
    for user, emails in emails_by_user.items():
        # get overlap between user emails and emails in slack
        user_slack_emails = set(emails) & set(slack_info_by_email.keys())
        if user_slack_emails:
            slack_data_by_user[user] = slack_info_by_email[list(user_slack_emails)[0]]
    return slack_data_by_user


def get_slack_user_list(
    integration: Integration | RpcIntegration,
    organization: Organization | RpcOrganization | None = None,
    kwargs: dict[str, Any] | None = None,
) -> Generator[list[dict[str, Any]]]:
    sdk_client = SlackSdkClient(integration_id=integration.id)
    try:
        users_list = (
            sdk_client.users_list(limit=SLACK_GET_USERS_PAGE_SIZE, **kwargs)
            if kwargs
            else sdk_client.users_list(limit=SLACK_GET_USERS_PAGE_SIZE)
        )
        metrics.incr(SLACK_UTILS_GET_USER_LIST_SUCCESS_DATADOG_METRIC, sample_rate=1.0)

        for page in users_list:
            yield page["members"]
    except SlackApiError as e:
        metrics.incr(SLACK_UTILS_GET_USER_LIST_FAILURE_DATADOG_METRIC, sample_rate=1.0)
        _logger.info(
            "slack.post_install.get_users.error",
            extra={
                "error": str(e),
                "organization": organization.slug if organization else None,
                "integration_id": integration.id,
            },
        )
        raise


def get_slack_data_by_user(
    integration: Integration | RpcIntegration,
    organization: Organization | RpcOrganization,
    emails_by_user: Mapping[User, Iterable[str]],
) -> Iterable[Mapping[User, SlackUserData]]:
    all_users = get_slack_user_list(integration, organization)
    yield from (format_slack_data_by_user(emails_by_user, users) for users in all_users)
