import abc
from typing import TYPE_CHECKING, Any, Dict, Mapping, MutableMapping, Optional, Tuple, Union

from sentry import analytics
from sentry.integrations.slack.message_builder import SlackAttachment
from sentry.integrations.slack.message_builder.notifications import (
    SlackNotificationsMessageBuilder,
    SlackProjectNotificationsMessageBuilder,
)
from sentry.mail.notifications import build_subject_prefix
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import group_id_to_email
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Organization, Project, Team, User
    from sentry.notifications.notifications.activity.base import ActivityNotification
    from sentry.notifications.notifications.rules import AlertRuleNotification


class BaseNotification:
    fine_tuning_key: Optional[str] = None
    SlackMessageBuilderClass = SlackNotificationsMessageBuilder  # need to override
    metrics_key: str = ""

    def __init__(self, organization: "Organization"):
        self.organization = organization

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        """The subject line when sending this notifications as an email."""
        raise NotImplementedError

    def get_subject_with_prefix(self, context: Optional[Mapping[str, Any]] = None) -> bytes:
        return self.get_subject(context).encode()

    def get_reference(self) -> Any:
        raise NotImplementedError

    def get_reply_reference(self) -> Optional[Any]:
        return None

    def should_email(self) -> bool:
        return True

    def get_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.txt"

    def get_html_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.html"

    def get_recipient_context(
        self, recipient: Union["Team", "User"], extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_notification_title(self) -> str:
        raise NotImplementedError

    def get_message_description(self) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_type(self) -> str:
        raise NotImplementedError

    def get_unsubscribe_key(self) -> Optional[Tuple[str, int, Optional[str]]]:
        return None

    def build_slack_attachment(
        self, context: Mapping[str, Any], recipient: Union["Team", "User"]
    ) -> SlackAttachment:
        return self.SlackMessageBuilderClass(self, context, recipient).build()

    def record_notification_sent(
        self, recipient: Union["Team", "User"], provider: ExternalProviders
    ) -> None:
        raise NotImplementedError

    def get_headers(self) -> Mapping[str, Any]:
        return {}

    def get_log_params(self, recipient: Union["Team", "User"]) -> Dict[str, Any]:
        return {
            "organization_id": self.organization.id,
            "actor_id": recipient.actor_id,
        }


class ProjectNotification(BaseNotification, abc.ABC):
    SlackMessageBuilderClass = SlackProjectNotificationsMessageBuilder
    is_message_issue_unfurl = False

    def __init__(self, project: "Project") -> None:
        self.project = project
        super().__init__(project.organization)

    def get_project_link(self) -> str:
        return str(absolute_uri(f"/{self.organization.slug}/{self.project.slug}/"))

    def record_notification_sent(
        self, recipient: Union["Team", "User"], provider: ExternalProviders
    ) -> None:
        analytics.record(
            f"integrations.{provider.name}.notification_sent",
            actor_id=recipient.id,
            category=self.get_category(),
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

    def get_log_params(self, recipient: Union["Team", "User"]) -> Dict[str, Any]:
        extra = {"project_id": self.project.id, **super().get_log_params(recipient)}
        group = getattr(self, "group", None)
        if group:
            extra.update({"group": group.id})

        # TODO: move logic to child classes
        if isinstance(self, AlertRuleNotification):
            extra.update(
                {
                    "target_type": self.target_type,
                    "target_identifier": self.target_identifier,
                }
            )
        elif isinstance(self, ActivityNotification):
            extra.update({"activity": self.activity})
        return extra

    def get_headers(self) -> Mapping[str, Any]:
        headers = {
            "X-Sentry-Project": self.project.slug,
            "X-SMTPAPI": json.dumps({"category": self.get_category()}),
        }

        # TODO: let the group subclass of notification handle this
        group = getattr(self, "group", None)
        if group:
            headers.update(
                {
                    "X-Sentry-Logger": group.logger,
                    "X-Sentry-Logger-Level": group.get_level_display(),
                    "X-Sentry-Reply-To": group_id_to_email(group.id),
                }
            )

        return headers

    def get_subject_with_prefix(self, context: Optional[Mapping[str, Any]] = None) -> bytes:
        prefix = build_subject_prefix(self.project)
        return f"{prefix}{self.get_subject(context)}".encode()
