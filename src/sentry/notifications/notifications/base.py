from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping

from typing_extensions import Literal

from sentry import analytics
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:

    from sentry.integrations.slack.message_builder import SlackAttachment
    from sentry.integrations.slack.message_builder.notifications import (
        SlackNotificationsMessageBuilder,
        SlackProjectNotificationsMessageBuilder,
    )
    from sentry.models import Organization, Project, Team, User


@dataclass
class MessageAction:
    label: str
    url: str
    style: Literal["primary", "danger", "default"] | None = None

    def as_slack(self) -> Mapping[str, Any]:
        return {
            "text": self.label,
            "name": self.label,
            "url": self.url,
            "style": self.style,
            "type": "button",
        }


class BaseNotification:
    fine_tuning_key: str | None = None
    metrics_key: str = ""

    def __init__(self, organization: Organization):
        self.organization = organization

    @property
    def SlackMessageBuilderClass(self) -> type[SlackNotificationsMessageBuilder]:
        from sentry.integrations.slack.message_builder.notifications import (
            SlackNotificationsMessageBuilder,
        )

        return SlackNotificationsMessageBuilder

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

    def get_message_description(self) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_type(self) -> str:
        raise NotImplementedError

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return None

    def build_slack_attachment(
        self, context: Mapping[str, Any], recipient: Team | User
    ) -> SlackAttachment:
        return self.SlackMessageBuilderClass(self, context, recipient).build()

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        raise NotImplementedError

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {
            "organization_id": self.organization.id,
            "actor_id": recipient.actor_id,
        }


class ProjectNotification(BaseNotification, abc.ABC):
    is_message_issue_unfurl = False

    def __init__(self, project: Project) -> None:
        self.project = project
        super().__init__(project.organization)

    @property
    def SlackMessageBuilderClass(self) -> type[SlackProjectNotificationsMessageBuilder]:
        from sentry.integrations.slack.message_builder.notifications import (
            SlackProjectNotificationsMessageBuilder,
        )

        return SlackProjectNotificationsMessageBuilder

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
