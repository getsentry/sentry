from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence

from sentry import analytics
from sentry.db.models import Model
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Organization, Project, Team, User


class BaseNotification(abc.ABC):
    @property
    def category(self) -> str:
        raise NotImplementedError

    @property
    def filename(self) -> str:
        raise NotImplementedError

    @property
    def type(self) -> str:
        raise NotImplementedError

    def get_context(self) -> MutableMapping[str, Any]:
        raise NotImplementedError

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {"actor_id": recipient.actor_id}

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_reference(self) -> Model | None:
        raise NotImplementedError

    def get_reply_reference(self) -> Any | None:
        return None

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        """The subject line when sending this notifications as an email."""
        raise NotImplementedError

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return None

    def get_email_template_filenames(self) -> tuple[str, str]:
        """
        Override this method if the templates are in an exotic location.
        Otherwise just set `filename` as a class variable.
        """
        return f"sentry/emails/{self.filename}.html", f"sentry/emails/{self.filename}.txt"

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        analytics.record(
            f"integrations.{provider.name}.notification_sent",
            category=self.category,
            **self.get_log_params(recipient),
        )


class OrganizationNotification(BaseNotification, abc.ABC):
    message_builder = "SlackNotificationsMessageBuilder"
    fine_tuning_key: str | None = None
    metrics_key: str = ""

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

    def get_base_context(self) -> MutableMapping[str, Any]:
        return {}

    def should_email(self) -> bool:
        return True

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

    def get_reference(self) -> Model | None:
        return self.organization

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {"organization_id": self.organization.id, **super().get_log_params(recipient)}

    def get_message_actions(self) -> Sequence[MessageAction]:
        return []

    def get_callback_data(self) -> Mapping[str, Any] | None:
        return None


class ProjectNotification(OrganizationNotification, abc.ABC):
    def __init__(self, project: Project) -> None:
        self.project = project
        super().__init__(project.organization)

    def get_project_link(self) -> str:
        # Explicitly typing to satisfy mypy.
        project_link: str = absolute_uri(f"/{self.organization.slug}/{self.project.slug}/")
        return project_link

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {"project_id": self.project.id, **super().get_log_params(recipient)}

    def get_reference(self) -> Model | None:
        return self.project
