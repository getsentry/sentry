from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Optional, Sequence
from urllib.parse import urljoin

import sentry_sdk

from sentry import analytics
from sentry.db.models import Model
from sentry.models import Environment, NotificationSetting, Team, User
from sentry.notifications.types import NotificationSettingTypes, get_notification_setting_type_name
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.user import APIUser
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from sentry.models import Organization, Project


# TODO: add abstractmethod decorators
class BaseNotification(abc.ABC):
    provider_to_url_format = {
        ExternalProviders.SLACK: "<{url}|{text}>",
        ExternalProviders.MSTEAMS: "[{text}]({url})",
    }
    message_builder = "SlackNotificationsMessageBuilder"
    # some notifications have no settings for it
    notification_setting_type: NotificationSettingTypes | None = None
    analytics_event: str = ""

    def __init__(self, organization: Organization):
        self.organization = organization

    @property
    def from_email(self) -> str | None:
        return None

    @property
    @abc.abstractmethod
    def metrics_key(self) -> str:
        """
        When we want to collect analytics about this type of notification, we
        will use this key. This MUST be snake_case.
        """
        pass

    def get_base_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_context(self) -> MutableMapping[str, Any]:
        return {**self.get_base_context()}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        """The subject line when sending this notifications as an email."""
        raise NotImplementedError

    @property
    def reference(self) -> Model | None:
        """
        The Sentry model with which this notification is associated. For
        example, an Activity or a Group.
        """
        raise NotImplementedError

    def format_url(self, text: str, url: str, provider: ExternalProviders) -> str:
        """
        Format URLs according to the provider options.
        """
        return self.provider_to_url_format[provider].format(text=text, url=url)

    @property
    @abc.abstractmethod
    def template_path(self) -> str:
        """
        Specify the location of the email notification templates, rooted at
        `src/sentry/templates/`. The HTML and text-only email templates MUST be
        in the same directory and have identical filenames, differing only by file
        extension. For example, if the templates are:
         - src/sentry/templates/path/to/example.html
         - src/sentry/templates/path/to/example.txt
        then set `template_path` for the notification to `path/to/example`.
        """
        return "sentry/emails/default"

    def get_recipient_context(
        self, recipient: Team | APIUser, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        """The subject line when sending this notifications as a chat notification."""
        raise NotImplementedError

    def get_title_link(self, recipient: Team | User, provider: ExternalProviders) -> str | None:
        raise NotImplementedError

    def build_attachment_title(self, recipient: Team | User) -> str:
        raise NotImplementedError

    def build_notification_footer(self, recipient: Team | User, provider: ExternalProviders) -> str:
        raise NotImplementedError

    def get_message_description(self, recipient: Team | User, provider: ExternalProviders) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return None

    def get_log_params(self, recipient: Team | APIUser) -> Mapping[str, Any]:
        group = getattr(self, "group", None)
        params = {
            "organization_id": self.organization.id,
            "actor_id": recipient.actor_id,
            "group_id": group.id if group else None,
        }
        if recipient.class_name() == "User":
            params["user_id"] = recipient.id
        return params

    def get_custom_analytics_params(self, recipient: Team | APIUser) -> Mapping[str, Any]:
        """
        Returns a mapping of params used to record the event associated with self.analytics_event.
        By default, use the log params.
        """
        return self.get_log_params(recipient)

    def get_message_actions(
        self, recipient: Team | User, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
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
                category=self.metrics_key,
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
        self, provider: ExternalProviders, recipient: Optional[Team | APIUser] = None
    ) -> str:
        # referrer needs the provider and recipient
        referrer = f"{self.metrics_key}-{EXTERNAL_PROVIDERS[provider]}"
        if recipient:
            referrer += "-" + recipient.class_name().lower()
        return referrer

    def get_sentry_query_params(
        self, provider: ExternalProviders, recipient: Optional[Team | APIUser] = None
    ) -> str:
        """
        Returns the query params that allow us to track clicks into Sentry links.
        If the recipient is not necessarily a user (ex: sending to an email address associated with an account),
        The recipient may be omitted.
        """
        return f"?referrer={self.get_referrer(provider, recipient)}"

    def get_settings_url(self, recipient: Team | APIUser, provider: ExternalProviders) -> str:
        # Settings url is dependant on the provider so we know which provider is sending them into Sentry.
        if isinstance(recipient, Team):
            url_str = f"/settings/{self.organization.slug}/teams/{recipient.slug}/notifications/"
        else:
            url_str = "/settings/account/notifications/"
            if self.notification_setting_type:
                fine_tuning_key = get_notification_setting_type_name(self.notification_setting_type)
                if fine_tuning_key:
                    url_str += f"{fine_tuning_key}/"

        return str(
            urljoin(
                absolute_uri(url_str),
                self.get_sentry_query_params(provider, recipient),
            )
        )

    def determine_recipients(self) -> Iterable[Team | APIUser]:
        raise NotImplementedError

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # subclass this method to limit notifications to specific providers
        from sentry.notifications.notify import notification_providers

        return notification_providers()

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | APIUser]]:
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

    def build_notification_footer(self, recipient: Team | User, provider: ExternalProviders) -> str:
        settings_url = self.get_settings_url(recipient, provider)

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

        footer += f" | {self.format_url(text='Notification Settings', url=settings_url, provider=provider)}"

        return footer
