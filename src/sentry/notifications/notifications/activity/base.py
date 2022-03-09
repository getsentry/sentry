from __future__ import annotations

from abc import ABC
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping
from urllib.parse import urlparse, urlunparse

from django.utils.html import escape
from django.utils.safestring import SafeString, mark_safe

from sentry.notifications.helpers import get_reason_context
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import NotificationSettingTypes
from sentry.notifications.utils import send_activity_notification
from sentry.notifications.utils.avatar import avatar_as_html
from sentry.notifications.utils.participants import get_participants_for_group
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Activity, Team, User


class ActivityNotification(ProjectNotification, ABC):
    notification_setting_type = NotificationSettingTypes.WORKFLOW
    metrics_key = "activity"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity.project)
        self.activity = activity

    def get_title(self) -> str:
        raise NotImplementedError

    def get_filename(self) -> str:
        return "activity/generic"

    def get_base_context(self) -> MutableMapping[str, Any]:
        """The most basic context shared by every notification type."""
        return {
            "data": self.activity.data,
            "author": self.activity.user,
            "title": self.get_title(),
            "project": self.project,
            "project_link": self.get_project_link(),
            **super().get_base_context(),
        }

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        return {**context, **get_reason_context(context)}

    def get_reference(self) -> Any:
        return self.activity

    def get_type(self) -> str:
        return f"notify.activity.{self.activity.get_type_display()}"

    def get_context(self) -> MutableMapping[str, Any]:
        raise NotImplementedError

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
        raise NotImplementedError

    def send(self) -> None:
        return send_activity_notification(self)

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {"activity": self.activity, **super().get_log_params(recipient)}


class GroupActivityNotification(ActivityNotification, ABC):
    message_builder = "IssueNotificationMessageBuilder"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = activity.group

    def get_activity_name(self) -> str:
        raise NotImplementedError

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        raise NotImplementedError

    def get_title(self) -> str:
        return self.get_activity_name()

    def get_group_link(self) -> str:
        # method only used for emails
        # TODO: pass in recipient so we can add that to the referrer
        referrer = self.get_referrer(ExternalProviders.EMAIL)
        return str(self.group.get_absolute_url(params={"referrer": referrer}))

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
        """This is overridden by the activity subclasses."""
        return get_participants_for_group(self.group, self.activity.user)

    def get_reply_reference(self) -> Any | None:
        return self.group

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return "issue", self.group.id, None

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
        description, params, html_params = self.get_description()
        return {
            **self.get_base_context(),
            "activity_name": self.get_activity_name(),
            "text_description": self.description_as_text(description, params),
            "html_description": self.description_as_html(description, html_params or params),
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

    def get_notification_title(self) -> str:
        description, params, _ = self.get_description()
        return self.description_as_text(description, params, True)

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"{self.group.qualified_short_id} - {self.group.title}"

    def description_as_text(
        self, description: str, params: Mapping[str, Any], url: bool | None = False
    ) -> str:
        user = self.activity.user
        if user:
            name = user.name or user.email
        else:
            name = "Sentry"

        issue_name = self.group.qualified_short_id or "an issue"
        if url and self.group.qualified_short_id:
            group_url = self.group.get_absolute_url(params={"referrer": "activity_notification"})
            issue_name = f"<{group_url}|{self.group.qualified_short_id}>"

        context = {"author": name, "an issue": issue_name}
        context.update(params)

        return description.format(**context)

    def description_as_html(self, description: str, params: Mapping[str, Any]) -> SafeString:
        user = self.activity.user
        if user:
            name = user.get_display_name()
        else:
            name = "Sentry"

        fmt = '<span class="avatar-container">{}</span> <strong>{}</strong>'

        author = mark_safe(fmt.format(avatar_as_html(user), escape(name)))

        issue_name = escape(self.group.qualified_short_id or "an issue")
        an_issue = f'<a href="{escape(self.get_group_link())}">{issue_name}</a>'

        context = {"author": author, "an issue": an_issue}
        context.update(params)

        return mark_safe(description.format(**context))

    def get_title_link(self, recipient: Team | User) -> str | None:
        from sentry.integrations.slack.message_builder.issues import get_title_link

        return get_title_link(self.group, None, False, True, self)

    def build_attachment_title(self, recipient: Team | User) -> str:
        from sentry.integrations.slack.message_builder.issues import build_attachment_title

        return build_attachment_title(self.group)

    def get_log_params(self, recipient: Team | User, **kwargs: Any) -> Mapping[str, Any]:
        return {"group": self.group.id, **super().get_log_params(recipient)}
