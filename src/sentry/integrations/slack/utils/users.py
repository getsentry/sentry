from __future__ import annotations

from collections.abc import Iterable, Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.shared_integrations.exceptions import ApiError

from ..utils import logger

SLACK_GET_USERS_PAGE_LIMIT = 100
SLACK_GET_USERS_PAGE_SIZE = 200


@dataclass(frozen=True)
class SlackUserData:
    email: str
    team_id: str
    slack_id: str


def get_users(integration: Integration, organization: Organization) -> Sequence[Mapping[str, Any]]:
    user_list = []
    next_cursor = None

    client = SlackClient(integration_id=integration.id)

    for _ in range(SLACK_GET_USERS_PAGE_LIMIT):
        try:
            next_users = client.get(
                "/users.list",
                params={"limit": SLACK_GET_USERS_PAGE_SIZE, "cursor": next_cursor},
            )
        except ApiError as e:
            logger.info(
                "post_install.fail.slack_users.list",
                extra={
                    "error": str(e),
                    "organization": organization.slug,
                    "integration_id": integration.id,
                },
            )
            break
        user_list += next_users["members"]

        next_cursor = next_users["response_metadata"]["next_cursor"]
        if not next_cursor:
            break

    return user_list


def get_slack_info_by_email(
    integration: Integration, organization: Organization
) -> Mapping[str, SlackUserData]:
    return {
        member["profile"]["email"]: SlackUserData(
            email=member["profile"]["email"], team_id=member["team_id"], slack_id=member["id"]
        )
        for member in get_users(integration, organization)
        if not member["deleted"] and member["profile"].get("email")
    }


def get_slack_data_by_user(
    integration: Integration | RpcIntegration,
    organization: Organization | RpcOrganization,
    emails_by_user: Mapping[User, Sequence[str]],
) -> Mapping[User, SlackUserData]:
    slack_info_by_email = get_slack_info_by_email(integration, organization)
    slack_data_by_user: MutableMapping[User, SlackUserData] = {}
    for user, emails in emails_by_user.items():
        for email in emails:
            if email in slack_info_by_email:
                slack_data_by_user[user] = slack_info_by_email[email]
                break
    return slack_data_by_user


# USING SDK CLIENT


def format_slack_info_by_email(users: dict[str, Any]) -> dict[str, SlackUserData]:
    return {
        member["profile"]["email"]: SlackUserData(
            email=member["profile"]["email"], team_id=member["team_id"], slack_id=member["id"]
        )
        for member in users
        if not member["deleted"] and member["profile"].get("email")
    }


def format_slack_data_by_user(
    emails_by_user: Mapping[User, Sequence[str]], users: dict[str, Any]
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
) -> Iterable[dict[str, Any]]:
    sdk_client = SlackSdkClient(integration_id=integration.id)
    try:
        users_list = (
            sdk_client.users_list(limit=SLACK_GET_USERS_PAGE_SIZE, **kwargs)
            if kwargs
            else sdk_client.users_list(limit=SLACK_GET_USERS_PAGE_SIZE)
        )

        for page in users_list:
            users: dict[str, Any] = page.get("members")

            yield users
    except SlackApiError as e:
        logger.info(
            "slack.post_install.get_users.error",
            extra={
                "error": str(e),
                "organization": organization.slug if organization else None,
                "integration_id": integration.id,
            },
        )


def get_slack_data_by_user_via_sdk(
    integration: Integration | RpcIntegration,
    organization: Organization | RpcOrganization,
    emails_by_user: Mapping[User, Sequence[str]],
) -> Iterable[Mapping[User, SlackUserData]]:
    all_users = get_slack_user_list(integration, organization)
    yield from (format_slack_data_by_user(emails_by_user, users) for users in all_users)
