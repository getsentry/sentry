import logging
from typing import Any, Mapping

from sentry.integrations.slack.client import SlackClient  # NOQA
from sentry.models import Activity, Group, Integration, Organization, Project, User

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


def send_slack_message_to_user(
    organization: Organization,
    integration: Integration,
    project: Project,
    user: User,
    activity: Activity,
    group: Group,
    context: Mapping[str, Any],
) -> None:
    pass
