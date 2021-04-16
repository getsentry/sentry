import re
from typing import Any, Callable, Iterable, Mapping, MutableMapping, Optional, Set, Tuple
from urllib.parse import urlparse, urlunparse

from django.core.urlresolvers import reverse
from django.utils.html import escape, mark_safe
from django.utils.safestring import SafeString

from sentry import options
from sentry.models import (
    Activity,
    Group,
    GroupSubscription,
    ProjectOption,
    User,
    UserAvatar,
    UserOption,
)
from sentry.notifications.types import GroupSubscriptionReason
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.avatar import get_email_avatar
from sentry.utils.email import group_id_to_email
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

registry: MutableMapping[ExternalProviders, Callable] = {}


def notification_providers() -> Iterable[ExternalProviders]:
    return registry.keys()


def register(provider: ExternalProviders) -> Callable:
    """
    A wrapper that adds the wrapped function to the send_notification_registry
    (see above) for the provider.
    """

    def wrapped(send_notification: Callable) -> Callable:
        registry[provider] = send_notification
        return send_notification

    return wrapped


class ActivityNotification:
    def __init__(self, activity: Activity) -> None:
        self.activity = activity
        self.project = activity.project
        self.organization = self.project.organization
        self.group = activity.group

    def _get_subject_prefix(self) -> str:
        prefix = ProjectOption.objects.get_value(project=self.project, key="mail:subject_prefix")
        if not prefix:
            prefix = options.get("mail.subject-prefix")
        return str(prefix)

    def should_email(self) -> bool:
        return True

    def get_providers_from_which_to_remove_user(
        self,
        user: User,
        participants_by_provider: Mapping[ExternalProviders, Mapping[User, int]],
    ) -> Set[ExternalProviders]:
        """
        Given a mapping of provider to mappings of users to why they should receive
        notifications for an activity, return the set of providers where the user
        has opted out of receiving notifications.
        """

        providers = {
            provider
            for provider, participants in participants_by_provider.items()
            if user in participants
        }
        if (
            providers
            and UserOption.objects.get_value(user, key="self_notifications", default="0") == "0"
        ):
            return providers
        return set()

    def get_participants(self) -> Mapping[ExternalProviders, Mapping[User, int]]:
        # TODO(dcramer): not used yet today except by Release's
        if not self.group:
            return {}

        participants_by_provider = GroupSubscription.objects.get_participants(self.group)
        user_option = self.activity.user
        if user_option:
            # Optionally remove the actor that created the activity from the recipients list.
            providers = self.get_providers_from_which_to_remove_user(
                user_option, participants_by_provider
            )
            for provider in providers:
                del participants_by_provider[provider][user_option]

        return participants_by_provider

    def get_template(self) -> str:
        return "sentry/emails/activity/generic.txt"

    def get_html_template(self) -> str:
        return "sentry/emails/activity/generic.html"

    def get_project_link(self) -> str:
        return str(absolute_uri(f"/{self.organization.slug}/{self.project.slug}/"))

    def get_group_link(self) -> str:
        referrer = re.sub("Notification$", "Email", self.__class__.__name__)
        return str(self.group.get_absolute_url(params={"referrer": referrer}))

    def get_base_context(self) -> MutableMapping[str, Any]:
        activity = self.activity

        context = {
            "data": activity.data,
            "author": activity.user,
            "project": self.project,
            "project_link": self.get_project_link(),
        }
        if activity.group:
            context.update(self.get_group_context())
        return context

    def get_group_context(self) -> MutableMapping[str, Any]:
        group_link = self.get_group_link()
        parts = list(urlparse(group_link))
        parts[2] = parts[2].rstrip("/") + "/activity/"
        activity_link = urlunparse(parts)

        return {
            "group": self.group,
            "link": group_link,
            "activity_link": activity_link,
            "referrer": self.__class__.__name__,
        }

    def get_email_type(self) -> str:
        return f"notify.activity.{self.activity.get_type_display()}"

    def get_subject(self) -> str:
        group = self.group

        return f"{group.qualified_short_id} - {group.title}"

    def get_subject_with_prefix(self) -> bytes:
        return f"{self._get_subject_prefix()}{self.get_subject()}".encode("utf-8")

    def get_activity_name(self) -> str:
        raise NotImplementedError

    def get_context(self) -> MutableMapping[str, Any]:
        description, params, html_params = self.get_description()
        return {
            "activity_name": self.get_activity_name(),
            "text_description": self.description_as_text(description, params),
            "html_description": self.description_as_html(description, html_params or params),
        }

    def get_user_context(self, user: User) -> MutableMapping[str, Any]:
        # use in case context of email changes depending on user
        return {}

    def get_category(self) -> str:
        raise NotImplementedError

    def get_headers(self) -> Mapping[str, Any]:
        project = self.project
        group = self.group

        headers = {
            "X-Sentry-Project": project.slug,
            "X-SMTPAPI": json.dumps({"category": self.get_category()}),
        }

        if group:
            headers.update(
                {
                    "X-Sentry-Logger": group.logger,
                    "X-Sentry-Logger-Level": group.get_level_display(),
                    "X-Sentry-Reply-To": group_id_to_email(group.id),
                }
            )

        return headers

    def get_description(self) -> Tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        raise NotImplementedError

    def avatar_as_html(self) -> str:
        user = self.activity.user
        if not user:
            return '<img class="avatar" src="{}" width="20px" height="20px" />'.format(
                escape(self._get_sentry_avatar_url())
            )
        avatar_type = user.get_avatar_type()
        if avatar_type == "upload":
            return f'<img class="avatar" src="{escape(self._get_user_avatar_url(user))}" />'
        elif avatar_type == "letter_avatar":
            return get_email_avatar(user.get_display_name(), user.get_label(), 20, False)
        else:
            return get_email_avatar(user.get_display_name(), user.get_label(), 20, True)

    def _get_sentry_avatar_url(self) -> str:
        url = "/images/sentry-email-avatar.png"
        return str(absolute_uri(get_asset_url("sentry", url)))

    def _get_user_avatar_url(self, user: User, size: int = 20) -> str:
        try:
            avatar = UserAvatar.objects.get(user=user)
        except UserAvatar.DoesNotExist:
            return ""

        url = reverse("sentry-user-avatar-url", args=[avatar.ident])
        if size:
            url = f"{url}?s={int(size)}"
        return str(absolute_uri(url))

    def description_as_text(self, description: str, params: Mapping[str, Any]) -> str:
        user = self.activity.user
        if user:
            name = user.name or user.email
        else:
            name = "Sentry"

        issue_name = self.group.qualified_short_id or "an issue"

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

        author = mark_safe(fmt.format(self.avatar_as_html(), escape(name)))

        issue_name = escape(self.group.qualified_short_id or "an issue")
        an_issue = f'<a href="{escape(self.get_group_link())}">{issue_name}</a>'

        context = {"author": author, "an issue": an_issue}
        context.update(params)

        return mark_safe(description.format(**context))

    def get_unsubscribe_link(self, user_id: int, group_id: int) -> str:
        return generate_signed_link(
            user_id,
            "sentry-account-email-unsubscribe-issue",
            kwargs={"issue_id": group_id},
        )

    def update_user_context_from_group(
        self,
        user: User,
        reason: int,
        context: MutableMapping[str, Any],
        group: Optional[Group],
    ) -> Mapping[str, Any]:
        if group:
            context.update(
                {
                    "reason": GroupSubscriptionReason.descriptions.get(
                        reason, "are subscribed to this issue"
                    ),
                    "unsubscribe_link": self.get_unsubscribe_link(user.id, group.id),
                }
            )
        user_context = self.get_user_context(user)
        user_context.update(context)
        return user_context

    def send(self) -> None:
        if not self.should_email():
            return

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            return

        context = self.get_base_context()
        context.update(self.get_context())

        for provider, participants in participants_by_provider.items():
            for user, reason in participants.items():
                user_context = self.update_user_context_from_group(
                    user, reason, context, self.group
                )
                registry[provider](self, user, user_context)
