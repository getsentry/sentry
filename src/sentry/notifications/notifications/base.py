from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence

from sentry import analytics
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Organization, Project, Team, User


class BaseNotification(abc.ABC):
    message_builder = "SlackNotificationsMessageBuilder"
    fine_tuning_key: str | None = None
    metrics_key: str = ""
    analytics_event: str = ""

    def __init__(self, organization: Organization):
        self.organization = organization

    @property
    def org_slug(self) -> str:
        slug: str = self.organization.slug
        return slug

    @property
    def org_name(self) -> str:
        name: str = self.organization.name
        return name

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_base_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        """The subject line when sending this notifications as an email."""
        raise NotImplementedError

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
        from sentry.integrations.slack.utils.notifications import build_notification_footer

        return build_notification_footer(self, recipient)

    def get_message_description(self) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_type(self) -> str:
        raise NotImplementedError

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return None

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {
            "organization_id": self.organization.id,
            "actor_id": recipient.actor_id,
        }

    def get_message_actions(self, recipient: Team | User) -> Sequence[MessageAction]:
        return []

    def get_callback_data(self) -> Mapping[str, Any] | None:
        return None

    def record_analytics(self, event_name: str, **kwargs: Any) -> None:
        analytics.record(event_name, **kwargs)

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        # may want to explicitly pass in the parameters for this event
        self.record_analytics(
            f"integrations.{provider.name}.notification_sent",
            category=self.get_category(),
            **self.get_log_params(recipient),
        )
        # record an optional second event
        if self.analytics_event:
            self.record_analytics(
                self.analytics_event,
                providers=provider.name.lower(),
                **self.get_log_params(recipient),
            )


class ProjectNotification(BaseNotification, abc.ABC):
    def __init__(self, project: Project) -> None:
        self.project = project
        super().__init__(project.organization)

    def get_project_link(self) -> str:
        # Explicitly typing to satisfy mypy.
        project_link: str = absolute_uri(f"/{self.organization.slug}/{self.project.slug}/")
        return project_link

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {"project_id": self.project.id, **super().get_log_params(recipient)}
