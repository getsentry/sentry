from __future__ import annotations

import abc
from functools import cached_property
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Optional
from urllib.parse import urlparse, urlunparse

from django.utils.html import format_html
from django.utils.safestring import SafeString

from sentry.db.models import Model
from sentry.notifications.helpers import get_reason_context
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import NotificationSettingEnum, UnsubscribeContext
from sentry.notifications.utils import send_activity_notification
from sentry.notifications.utils.avatar import avatar_as_html
from sentry.notifications.utils.participants import ParticipantMap, get_participants_for_group
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models.activity import Activity


class ActivityNotification(ProjectNotification, abc.ABC):
    metrics_key = "activity"
    notification_setting_type_enum = NotificationSettingEnum.WORKFLOW
    template_path = "sentry/emails/activity/generic"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity.project)
        self.activity = activity

    @property
    @abc.abstractmethod
    def title(self) -> str:
        """The header for Workflow notifications."""
        pass

    def get_base_context(self) -> MutableMapping[str, Any]:
        """The most basic context shared by every notification type."""
        return {
            "data": self.activity.data,
            "title": self.title,
            "project": self.project,
            "project_link": self.get_project_link(),
            **super().get_base_context(),
        }

    def get_recipient_context(
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        return {**context, **get_reason_context(context)}

    @property
    def reference(self) -> Model | None:
        return self.activity

    @abc.abstractmethod
    def get_context(self) -> MutableMapping[str, Any]:
        pass

    @abc.abstractmethod
    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        pass

    def send(self) -> None:
        return send_activity_notification(self)

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        return {"activity": self.activity, **super().get_log_params(recipient)}


class GroupActivityNotification(ActivityNotification, abc.ABC):
    message_builder = "IssueNotificationMessageBuilder"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = activity.group

    def get_description(self) -> tuple[str, Optional[str], Mapping[str, Any]]:
        raise NotImplementedError

    def get_group_link(self) -> str:
        # method only used for emails
        # TODO: pass in recipient so we can add that to the referrer
        referrer = self.get_referrer(ExternalProviders.EMAIL)
        return str(
            self.group.get_absolute_url(
                params={"referrer": referrer, "notification_uuid": self.notification_uuid}
            )
        )

    @cached_property
    def user(self) -> RpcUser | None:
        return (
            user_service.get_user(self.activity.user_id)
            if self.activity.user_id is not None
            else None
        )

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        """This is overridden by the activity subclasses."""
        return get_participants_for_group(self.group, self.activity.user_id)

    def get_unsubscribe_key(self) -> UnsubscribeContext | None:
        return UnsubscribeContext(
            organization=self.group.organization,
            key="issue",
            resource_id=self.group.id,
        )

    def get_base_context(self) -> MutableMapping[str, Any]:
        return {
            **super().get_base_context(),
            **self.get_group_context(),
        }

    def get_context(self) -> MutableMapping[str, Any]:
        """
        Context shared by every recipient of this notification. This may contain
        expensive computation so it should only be called once. Override this
        method if the notification does not need HTML/text descriptions.
        """
        text_template, html_template, params = self.get_description()
        text_description = self.description_as_text(text_template, params)
        html_description = self.description_as_html(html_template or text_template, params)
        return {
            **self.get_base_context(),
            "text_description": text_description,
            "html_description": html_description,
        }

    def get_group_context(self) -> MutableMapping[str, Any]:
        group_link = self.get_group_link()
        parts = list(urlparse(group_link))
        parts[2] = parts[2].rstrip("/") + "/activity/"
        activity_link = urlunparse(parts)

        return {
            "organization": self.group.project.organization,
            "group": self.group,
            "link": group_link,
            "activity_link": activity_link,
            "referrer": self.__class__.__name__,
        }

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        description, _, params = self.get_description()
        return self.description_as_text(description, params, True, provider)

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"{self.group.qualified_short_id} - {self.group.title}"

    def description_as_text(
        self,
        description: str,
        params: Mapping[str, Any],
        url: bool | None = False,
        provider: ExternalProviders | None = None,
    ) -> str:
        if self.user:
            name = self.user.name or self.user.email
        else:
            name = "Sentry"

        issue_name = self.group.qualified_short_id or "an issue"
        if url and self.group.qualified_short_id:
            group_url = self.group.get_absolute_url(
                params={
                    "referrer": "activity_notification",
                    "notification_uuid": self.notification_uuid,
                }
            )
            issue_name = f"{self.format_url(text=self.group.qualified_short_id, url=group_url, provider=provider)}"

        context = {"author": name, "an issue": issue_name}
        context.update(params)

        return description.format(**context)

    def description_as_html(self, description: str, params: Mapping[str, Any]) -> SafeString:
        if self.user:
            name = self.user.get_display_name()
        else:
            name = "Sentry"

        fmt = '<span class="avatar-container">{}</span> <strong>{}</strong>'

        author = format_html(fmt, avatar_as_html(self.user), name)

        issue_name = self.group.qualified_short_id or "an issue"
        an_issue = format_html('<a href="{}">{}</a>', self.get_group_link(), issue_name)

        context = {"author": author, "an issue": an_issue}
        context.update(params)

        return format_html(description, **context)

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        from sentry.integrations.message_builder import get_title_link

        return get_title_link(self.group, None, False, True, self, provider)

    def build_attachment_title(self, recipient: RpcActor) -> str:
        from sentry.integrations.message_builder import build_attachment_title

        return build_attachment_title(self.group)

    def get_log_params(self, recipient: RpcActor, **kwargs: Any) -> Mapping[str, Any]:
        return {"group": self.group.id, **super().get_log_params(recipient)}
