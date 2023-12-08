from __future__ import annotations

import abc
import uuid
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Optional, Sequence
from urllib.parse import urlencode

import sentry_sdk

from sentry import analytics
from sentry.db.models import Model
from sentry.models.environment import Environment
from sentry.notifications.types import NotificationSettingEnum, UnsubscribeContext
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project


# TODO: add abstractmethod decorators
class BaseNotification(abc.ABC):
    provider_to_url_format = {
        ExternalProviders.SLACK: "<{url}|{text}>",
        ExternalProviders.MSTEAMS: "[{text}]({url})",
        ExternalProviders.DISCORD: "[{text}]({url})",
    }
    message_builder = "SlackNotificationsMessageBuilder"
    # some notifications have no settings for it which is why it is optional
    notification_setting_type_enum: NotificationSettingEnum | None = None
    analytics_event: str = ""

    def __init__(self, organization: Organization, notification_uuid: str | None = None):
        self.organization = organization
        self.notification_uuid = notification_uuid if notification_uuid else str(uuid.uuid4())

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
        pass

    def get_recipient_context(
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        # Basically a noop.
        return {**extra_context}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        """The subject line when sending this notifications as a chat notification."""
        raise NotImplementedError

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        raise NotImplementedError

    def build_attachment_title(self, recipient: RpcActor) -> str:
        raise NotImplementedError

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        raise NotImplementedError

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> Any:
        context = getattr(self, "context", None)
        return context["text_description"] if context else None

    def get_unsubscribe_key(self) -> UnsubscribeContext | None:
        return None

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        group = getattr(self, "group", None)
        params = {
            "organization_id": self.organization.id,
            "id": recipient.id,
            "actor_type": recipient.actor_type,
            "group_id": group.id if group else None,
        }
        if recipient.actor_type == ActorType.USER:
            params["user_id"] = recipient.id
        return params

    def get_custom_analytics_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        """
        Returns a mapping of params used to record the event associated with self.analytics_event.
        By default, use the log params.
        """
        return self.get_log_params(recipient)

    def get_message_actions(
        self, recipient: RpcActor, provider: ExternalProviders
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

    def record_notification_sent(self, recipient: RpcActor, provider: ExternalProviders) -> None:
        with sentry_sdk.start_span(op="notification.send", description="record_notification_sent"):
            # may want to explicitly pass in the parameters for this event
            self.record_analytics(
                f"integrations.{provider.name}.notification_sent",
                category=self.metrics_key,
                notification_uuid=self.notification_uuid if self.notification_uuid else "",
                **self.get_log_params(recipient),
            )
            # record an optional second event
            if self.analytics_event:
                self.record_analytics(
                    self.analytics_event,
                    self.analytics_instance,
                    providers=provider.name.lower() if provider.name else "",
                    **self.get_custom_analytics_params(recipient),
                )

    def get_referrer(
        self, provider: ExternalProviders, recipient: Optional[RpcActor] = None
    ) -> str:
        # referrer needs the provider and recipient
        referrer = f"{self.metrics_key}-{EXTERNAL_PROVIDERS[provider]}"
        if recipient:
            referrer += "-" + str(recipient.actor_type).lower()
        return referrer

    def get_sentry_query_params(
        self, provider: ExternalProviders, recipient: Optional[RpcActor] = None
    ) -> str:
        """
        Returns the query params that allow us to track clicks into Sentry links.
        If the recipient is not necessarily a user (ex: sending to an email address associated with an account),
        The recipient may be omitted.
        """
        query = urlencode(
            {
                "referrer": self.get_referrer(provider, recipient),
                "notification_uuid": self.notification_uuid,
            }
        )
        return f"?{query}"

    def get_settings_url(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        # Settings url is dependant on the provider so we know which provider is sending them into Sentry.
        if recipient.actor_type == ActorType.TEAM:
            url_str = f"/settings/{self.organization.slug}/teams/{recipient.slug}/notifications/"
        else:
            url_str = "/settings/account/notifications/"
            if self.notification_setting_type_enum:
                fine_tuning_key = self.notification_setting_type_enum.value
                if fine_tuning_key:
                    url_str += f"{fine_tuning_key}/"

        return str(
            self.organization.absolute_url(
                url_str, query=self.get_sentry_query_params(provider, recipient)
            )
        )

    def determine_recipients(self) -> list[RpcActor]:
        raise NotImplementedError

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # subclass this method to limit notifications to specific providers
        from sentry.notifications.notify import notification_providers

        return notification_providers()

    def filter_to_accepting_recipients(
        self, recipients: Iterable[RpcActor]
    ) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        from sentry.notifications.utils.participants import get_notification_recipients

        setting_type = (
            self.notification_setting_type_enum
            if self.notification_setting_type_enum
            else NotificationSettingEnum.ISSUE_ALERTS
        )
        return get_notification_recipients(
            recipients=recipients,
            type=setting_type,
            organization_id=self.organization.id,
        )

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        # need a notification_setting_type_enum to call this function
        if not self.notification_setting_type_enum:
            raise NotImplementedError

        available_providers = self.get_notification_providers()
        recipients = list(self.determine_recipients())
        recipients_by_provider = self.filter_to_accepting_recipients(recipients)

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
    def __init__(self, project: Project, notification_uuid: str | None = None) -> None:
        self.project = project
        super().__init__(project.organization, notification_uuid)

    def get_project_link(self) -> str:
        return self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/projects/{self.project.slug}/"
        )

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        return {"project_id": self.project.id, **super().get_log_params(recipient)}

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
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
