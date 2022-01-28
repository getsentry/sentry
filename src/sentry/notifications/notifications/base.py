from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Optional, Sequence
from urllib.parse import urljoin

import sentry_sdk

from sentry import analytics
from sentry.models import Environment, NotificationSetting, Team
from sentry.notifications.types import NotificationSettingTypes, get_notification_setting_type_name
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from sentry.models import Organization, Project, User


# TODO: add abstractmethod decorators
class BaseNotification(abc.ABC):
    message_builder = "SlackNotificationsMessageBuilder"
    # some notifications have no settings for it
    notification_setting_type: NotificationSettingTypes | None = None
    metrics_key: str = ""
    analytics_event: str = ""
    referrer_base: str = ""

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

    @property
    def fine_tuning_key(self) -> str | None:
        if self.notification_setting_type is None:
            return None
        return get_notification_setting_type_name(self.notification_setting_type)

    @property
    def from_email(self) -> str | None:
        return None

    def get_filename(self) -> str:
        raise NotImplementedError

    def get_category(self) -> str:
        raise NotImplementedError

    def get_base_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_context(self) -> MutableMapping[str, Any]:
        return {**self.get_base_context()}

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

    def get_title_link(self, recipient: Team | User) -> str | None:
        raise NotImplementedError

    def build_attachment_title(self, recipient: Team | User) -> str:
        raise NotImplementedError

    def build_notification_footer(self, recipient: Team | User) -> str:
        raise NotImplementedError

    def get_message_description(self, recipient: Team | User) -> Any:
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

    def get_custom_analytics_params(self, recipient: Team | User) -> Mapping[str, Any]:
        """
        Returns a mapping of params used to record the event associated with self.analytics_event.
        By default, use the log params.
        """
        return self.get_log_params(recipient)

    def get_message_actions(self, recipient: Team | User) -> Sequence[MessageAction]:
        return []

    def get_callback_data(self) -> Mapping[str, Any] | None:
        return None

    @property
    def analytics_instance(self) -> Any | None:
        """
        Returns an instance for that can be used for analytics such as an organization or project
        """
        return None

    def record_analytics(self, event_name: str, *args: Any, **kwargs: Any) -> None:
        analytics.record(event_name, *args, **kwargs)

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        with sentry_sdk.start_span(op="notification.send", description="record_notification_sent"):
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
                    self.analytics_instance,
                    providers=provider.name.lower(),
                    **self.get_custom_analytics_params(recipient),
                )

    def get_referrer(
        self, provider: ExternalProviders, recipient: Optional[Team | User] = None
    ) -> str:
        # referrer needs the provider and recipient
        referrer = f"{self.referrer_base}-{EXTERNAL_PROVIDERS[provider]}"
        if recipient:
            referrer += "-" + recipient.__class__.__name__.lower()
        return referrer

    def get_sentry_query_params(
        self, provider: ExternalProviders, recipient: Optional[Team | User] = None
    ) -> str:
        """
        Returns the query params that allow us to track clicks into Sentry links.
        If the recipient is not necessarily a user (ex: sending to an email address associated with an account),
        The recipient may be omitted.
        """
        return f"?referrer={self.get_referrer(provider, recipient)}"

    def get_settings_url(self, recipient: Team | User, provider: ExternalProviders) -> str:
        # settings url is dependant on the provider so we know which provider is sending them into Sentry
        if isinstance(recipient, Team):
            team = Team.objects.get(id=recipient.id)
            url_str = f"/settings/{self.org_slug}/teams/{team.slug}/notifications/"
        else:
            url_str = "/settings/account/notifications/"
            if self.fine_tuning_key:
                url_str += f"{self.fine_tuning_key}/"
        return str(
            urljoin(absolute_uri(url_str), self.get_sentry_query_params(provider, recipient))
        )

    def determine_recipients(self) -> Iterable[Team | User]:
        raise NotImplementedError

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # subclass this method to limit notifications to specific providers
        from sentry.notifications.notify import notification_providers

        return notification_providers()

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        # need a notification_setting_type to call this function
        if not self.notification_setting_type:
            raise NotImplementedError

        available_providers = self.get_notification_providers()
        recipients = list(self.determine_recipients())
        recipients_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(
            self.organization, recipients, self.notification_setting_type
        )

        return {
            provider: recipients_of_provider
            for provider, recipients_of_provider in recipients_by_provider.items()
            if provider in available_providers
        }

    def send(self) -> None:
        """The default way to send notifications that respects Notification Settings."""
        from sentry.notifications.notify import notify

        with sentry_sdk.start_span(op="notification.send", description="get_participants"):
            participants_by_provider = self.get_participants()
            if not participants_by_provider:
                return

        context = self.get_context()
        for provider, recipients in participants_by_provider.items():
            with sentry_sdk.start_span(op="notification.send", description=f"send_for_{provider}"):
                safe_execute(notify, provider, self, recipients, context)


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

    def build_notification_footer(self, recipient: Team | User) -> str:
        # notification footer only used for Slack for now
        settings_url = self.get_settings_url(recipient, ExternalProviders.SLACK)

        parent = getattr(self, "project", self.organization)
        footer: str = parent.slug
        group = getattr(self, "group", None)
        latest_event = group.get_latest_event() if group else None
        environment = None
        if latest_event:
            try:
                environment = latest_event.get_environment()
            except Environment.DoesNotExist:
                pass
        if environment and getattr(environment, "name", None) != "":
            footer += f" | {environment.name}"
        footer += f" | <{settings_url}|Notification Settings>"
        return footer
