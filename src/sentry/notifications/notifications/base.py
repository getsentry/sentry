from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence

from sentry import analytics
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Organization, Project, Team, User


class BaseNotification:
    message_builder = "SlackNotificationsMessageBuilder"
    fine_tuning_key: str | None = None
    metrics_key: str = ""

    def __init__(self, organization: Organization):
        self.organization = organization

    @property
    def org_slug(self) -> str:
        return str(self.organization.slug)

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        """The subject line when sending this notifications as an email."""
        raise NotImplementedError

    def get_subject_with_prefix(self, context: Mapping[str, Any] | None = None) -> bytes:
        return self.get_subject(context).encode()

    def get_reference(self) -> Any:
        raise NotImplementedError

    def get_reply_reference(self) -> Any | None:
        return None

    def should_email(self) -> bool:
        return True

    def get_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.txt"

    def get_html_template(self) -> str:
        return f"sentry/emails/{self.get_filename()}.html"

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_notification_title(self) -> str:
        raise NotImplementedError

    def get_title_link(self) -> str | None:
        raise NotImplementedError

    def build_attachment_title(self) -> str:
        raise NotImplementedError

    def build_notification_footer(self, recipient: Team | User) -> str:
        raise NotImplementedError

    def get_message_description(self) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_type(self) -> str:
        raise NotImplementedError

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return None

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        raise NotImplementedError

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {
            "organization_id": self.organization.id,
            "actor_id": recipient.actor_id,
        }

    def get_message_actions(self) -> Sequence[MessageAction]:
        return []


class ProjectNotification(BaseNotification, abc.ABC):
    def __init__(self, project: Project) -> None:
        self.project = project
        super().__init__(project.organization)

    def get_project_link(self) -> str:
        return str(absolute_uri(f"/{self.organization.slug}/{self.project.slug}/"))

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        analytics.record(
            f"integrations.{provider.name.lower()}.notification_sent",
            actor_id=recipient.id,
            category=self.get_category(),
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        from sentry.notifications.notifications.activity.base import ActivityNotification
        from sentry.notifications.notifications.rules import AlertRuleNotification

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

    def get_subject_with_prefix(self, context: Mapping[str, Any] | None = None) -> bytes:
        from sentry.mail.notifications import build_subject_prefix

        prefix = build_subject_prefix(self.project)
        return f"{prefix}{self.get_subject(context)}".encode()

    def build_notification_footer(self, recipient: Team | User) -> str:
        from sentry.integrations.slack.utils.notifications import build_notification_footer

        return build_notification_footer(self, recipient)
