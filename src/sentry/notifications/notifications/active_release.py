from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Optional, Sequence, TypedDict
from urllib.parse import quote, urlencode

from sentry import features
from sentry.models import (
    GroupOwner,
    GroupOwnerType,
    Release,
    ReleaseActivity,
    ReleaseCommit,
    Team,
    User,
)
from sentry.notifications.notifications.rules import AlertRuleNotification, logger
from sentry.notifications.types import ActionTargetType, NotificationSettingTypes
from sentry.notifications.utils import (
    get_group_settings_link,
    get_integration_link,
    get_interface_list,
    has_alert_integration,
    has_integrations,
)
from sentry.notifications.utils.participants import get_owners
from sentry.plugins.base import Notification
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.releaseactivity import ReleaseActivityType
from sentry.utils import metrics


class ActiveReleaseIssueNotification(AlertRuleNotification):
    message_builder = "ActiveReleaseIssueNotificationMessageBuilder"
    metrics_key = "release_issue_alert"
    notification_setting_type = NotificationSettingTypes.ACTIVE_RELEASE
    template_path = "sentry/emails/release_alert"
    analytics_event = "active_release_notification.sent"

    def __init__(  # type: ignore
        self,
        notification: Notification,
        event_state,
        target_type: ActionTargetType,
        target_identifier: int | None = None,
        last_release: Optional[Release] = None,
    ) -> None:
        from sentry.rules.conditions.active_release import ActiveReleaseEventCondition

        super().__init__(notification, target_type, target_identifier)
        self.last_release = (
            last_release
            if last_release
            else ActiveReleaseEventCondition.latest_release(notification.event)
        )
        self.event_state = event_state

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return "Active Release alert triggered"

    def send(self) -> None:
        from sentry.notifications.notify import notify

        metrics.incr("mail_adapter.notify_active_release")
        logger.info(
            "mail.adapter.notify_active_release",
            extra={
                "target_type": self.target_type.value,
                "target_identifier": self.target_identifier,
                "group": self.group.id,
                "project_id": self.project.id,
            },
        )

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            logger.info(
                "notifications.notification.rules.active_release.skip.no_participants",
                extra={
                    "target_type": self.target_type.value,
                    "target_identifier": self.target_identifier,
                    "group": self.group.id,
                    "project_id": self.project.id,
                },
            )
            return

        shared_context = self.get_context()
        for provider, participants in participants_by_provider.items():
            if (
                features.has("organizations:active-release-monitor-alpha", self.organization)
                and self.last_release
            ):
                ReleaseActivity.objects.create(
                    type=ReleaseActivityType.ISSUE.value,
                    data={
                        "provider": EXTERNAL_PROVIDERS[provider],
                        "group_id": self.group.id,
                    },
                    release=self.last_release,
                )
            notify(provider, self, participants, shared_context)

    def get_context(self) -> MutableMapping[str, Any]:
        environment = self.event.get_tag("environment")
        enhanced_privacy = self.organization.flags.enhanced_privacy
        group = self.group
        context = {
            "project_label": self.project.get_full_name(),
            "group": group,
            "users_seen": self.group.count_users_seen(),
            "event": self.event,
            "link": get_group_settings_link(
                self.group, environment, rule_details=None, referrer="alert_email_release"
            ),
            "has_integrations": has_integrations(self.organization, self.project),
            "enhanced_privacy": enhanced_privacy,
            "last_release": self.last_release,
            "last_release_link": self.release_url(self.last_release),
            "last_release_slack_link": self.slack_release_url(self.last_release),
            "environment": environment,
            "slack_link": get_integration_link(self.organization, "slack"),
            "has_alert_integration": has_alert_integration(self.project),
            "regression": self.event_state.is_regression
            if self.event_state and self.event_state.is_regression
            else False,
        }

        # if the organization has enabled enhanced privacy controls we don't send
        # data which may show PII or source code
        if not enhanced_privacy:
            contexts = (
                self.event.data["contexts"].items() if "contexts" in self.event.data else None
            )
            event_user = self.event.data["event_user"] if "event_user" in self.event.data else None
            context.update(
                {
                    "tags": self.event.tags,
                    "interfaces": get_interface_list(self.event),
                    "contexts": contexts,
                    "event_user": event_user,
                }
            )

        return context

    def get_custom_analytics_params(self, recipient: Team | User) -> Mapping[str, Any]:
        suspect_committer_ids = [
            go.owner_id()
            for go in GroupOwner.objects.filter(
                group_id=self.group.id,
                project=self.project.id,
                organization_id=self.project.organization.id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
            )
        ]
        code_owner_ids = [o.id for o in get_owners(self.project, self.event)]
        team_ids = (
            [t.id for t in Team.objects.get_for_user(self.organization, recipient)]
            if type(recipient) == User
            else None
        )

        return {
            "organization_id": self.project.organization.id,
            "project_id": self.project.id,
            "group_id": self.group.id,
            "release_version": self.last_release.version if self.last_release else None,
            "recipient_email": recipient.email if type(recipient) == User else None,
            "recipient_username": recipient.username if type(recipient) == User else None,
            "suspect_committer_ids": suspect_committer_ids,
            "code_owner_ids": code_owner_ids,
            "team_ids": team_ids,
        }

    @staticmethod
    def get_release_commits(release: Release) -> Sequence[CommitData]:
        if not release:
            return []

        release_commits = (
            ReleaseCommit.objects.filter(release_id=release.id)
            .select_related("commit", "commit__author")
            .order_by("-order")
        )

        return [
            {
                "author": rc.commit.author,
                "subject": rc.commit.message.split("\n", 1)[0]
                if rc.commit.message
                else "no subject",
                "key": rc.commit.key,
            }
            for rc in release_commits
        ]

    @staticmethod
    def release_url(release: Release) -> str:
        organization = release.organization
        params = {"project": release.project_id, "referrer": "alert_email_release"}
        url = f"/organizations/{organization.slug}/releases/{release.version}/"

        return str(organization.absolute_url(url, query=urlencode(params)))

    @staticmethod
    def slack_release_url(release: Release) -> str:
        organization = release.organization
        params = {"project": release.project_id, "referrer": "alert_slack_release"}
        url = f"/organizations/{organization.slug}/releases/{quote(release.version)}/"

        return str(organization.absolute_url(url, query=urlencode(params)))


class CommitData(TypedDict):
    author: User
    subject: str
    key: str
