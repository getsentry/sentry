from typing import Any, Mapping, MutableMapping, Sequence

from sentry.integrations.slack.client import SlackClient
from sentry.models import Integration, Organization, User
from sentry.shared_integrations.exceptions import ApiError

from ..utils import logger

SLACK_GET_USERS_PAGE_LIMIT = 100
SLACK_GET_USERS_PAGE_SIZE = 200


def get_users(integration: Integration, organization: Organization) -> Sequence[Mapping[str, Any]]:
    access_token = (
        integration.metadata.get("user_access_token") or integration.metadata["access_token"]
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    client = SlackClient()

    user_list = []
    next_cursor = None
    for i in range(SLACK_GET_USERS_PAGE_LIMIT):
        try:
            next_users = client.get(
                "/users.list",
                headers=headers,
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
) -> Mapping[str, Mapping[str, str]]:
    return {
        member["profile"]["email"]: {
            "email": member["profile"]["email"],
            "team_id": member["team_id"],
            "slack_id": member["id"],
        }
        for member in get_users(integration, organization)
        if not member["deleted"] and member["profile"].get("email")
    }


def get_slack_data_by_user(
    integration: Integration,
    organization: Organization,
    emails_by_user: Mapping[User, Sequence[str]],
) -> Mapping[User, Mapping[str, str]]:
    slack_info_by_email = get_slack_info_by_email(integration, organization)
    slack_data_by_user: MutableMapping[User, Mapping[str, str]] = {}
    for user, emails in emails_by_user.items():
        for email in emails:
            if email in slack_info_by_email:
                slack_data_by_user[user] = slack_info_by_email[email]
                break
    return slack_data_by_user
