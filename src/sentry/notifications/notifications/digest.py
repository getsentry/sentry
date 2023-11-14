from __future__ import annotations

import logging
from collections import defaultdict
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence
from urllib.parse import urlencode

from sentry import analytics, features
from sentry.db.models import Model
from sentry.digests import Digest
from sentry.digests.utils import (
    get_digest_as_context,
    get_participants_by_event,
    get_personalized_digests,
    should_get_personalized_digests,
)
from sentry.eventstore.models import Event
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.notify import notify
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType, UnsubscribeContext
from sentry.notifications.utils import (
    NotificationRuleDetails,
    get_email_link_extra_params,
    get_integration_link,
    get_rules,
    has_alert_integration,
)
from sentry.notifications.utils.digest import (
    get_digest_subject,
    send_as_alert_notification,
    should_send_as_alert_notification,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils.dates import to_timestamp

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

logger = logging.getLogger(__name__)


class DigestNotification(ProjectNotification):
    message_builder = "DigestNotificationMessageBuilder"
    metrics_key = "digest"
    template_path = "sentry/emails/digests/body"

    def __init__(
        self,
        project: Project,
        digest: Digest,
        target_type: ActionTargetType,
        target_identifier: int | None = None,
        fallthrough_choice: FallthroughChoiceType | None = None,
        notification_uuid: str | None = None,
    ) -> None:
        super().__init__(project, notification_uuid)
        self.digest = digest
        self.target_type = target_type
        self.target_identifier = target_identifier
        self.fallthrough_choice = fallthrough_choice

    def get_unsubscribe_key(self) -> UnsubscribeContext | None:
        return UnsubscribeContext(
            organization=self.project.organization,
            key="project",
            resource_id=self.project.id,
            referrer="alert_digest",
        )

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        if not context:
            # This shouldn't be possible but adding a message just in case.
            return "Digest Report"

        return get_digest_subject(context["group"], context["counts"], context["start"])

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        if not context:
            return "Digest Report"
        project = context["group"].project
        organization = project.organization

        return "<!date^{:.0f}^{count} {noun} detected {date} in| Digest Report for> <{project_link}|{project_name}>".format(
            to_timestamp(context["start"]),
            count=len(context["counts"]),
            noun="issue" if len(context["counts"]) == 1 else "issues",
            project_link=organization.absolute_url(
                f"/organizations/{organization.slug}/projects/{project.slug}/"
            ),
            project_name=project.name,
            date="{date_pretty}",
        )

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return ""

    @property
    def reference(self) -> Model | None:
        return self.project

    def get_context(self) -> MutableMapping[str, Any]:
        rule_details = get_rules(list(self.digest.keys()), self.project.organization, self.project)
        context = DigestNotification.build_context(
            self.digest,
            self.project,
            self.project.organization,
            rule_details,
            notification_uuid=self.notification_uuid,
        )

        sentry_query_params = self.get_sentry_query_params(ExternalProviders.EMAIL)

        snooze_alert = len(rule_details) > 0
        snooze_alert_urls = {
            rule.id: f"{rule.status_url}{sentry_query_params}&{urlencode({'mute': '1'})}"
            for rule in rule_details
        }

        context["snooze_alert"] = snooze_alert
        context["snooze_alert_urls"] = snooze_alert_urls

        return context

    @staticmethod
    def build_context(
        digest: Digest,
        project: Project,
        organization: Organization,
        rule_details: Sequence[NotificationRuleDetails],
        alert_timestamp: int | None = None,
        notification_uuid: str | None = None,
    ) -> MutableMapping[str, Any]:
        has_session_replay = features.has("organizations:session-replay", organization)
        show_replay_link = features.has("organizations:session-replay-issue-emails", organization)
        return {
            **get_digest_as_context(digest),
            "has_alert_integration": has_alert_integration(project),
            "project": project,
            "slack_link": get_integration_link(organization, "slack"),
            "rules_details": {rule.id: rule for rule in rule_details},
            "link_params_for_rule": get_email_link_extra_params(
                "digest_email",
                None,
                rule_details,
                alert_timestamp,
                notification_uuid=notification_uuid,
            ),
            "show_replay_links": has_session_replay and show_replay_link,
        }

    def get_extra_context(
        self,
        participants_by_provider_by_event: Mapping[
            Event, Mapping[ExternalProviders, set[RpcActor]]
        ],
    ) -> Mapping[RpcActor, Mapping[str, Any]]:
        personalized_digests = get_personalized_digests(
            self.digest, participants_by_provider_by_event
        )
        return {
            actor: get_digest_as_context(digest) for actor, digest in personalized_digests.items()
        }

    def send(self) -> None:
        # Only calculate shared context once.
        shared_context = self.get_context()

        if should_send_as_alert_notification(shared_context):
            return send_as_alert_notification(
                shared_context, self.target_type, self.target_identifier, self.fallthrough_choice
            )

        participants_by_provider_by_event = get_participants_by_event(
            self.digest,
            self.project,
            self.target_type,
            self.target_identifier,
            self.fallthrough_choice,
        )

        # Get every actor ID for every provider as a set.
        team_ids = set()
        user_ids = set()
        combined_participants_by_provider = defaultdict(set)
        for participants_by_provider in participants_by_provider_by_event.values():
            for provider, participants in participants_by_provider.items():
                for participant in participants:
                    if participant.actor_type == ActorType.TEAM:
                        team_ids.add(participant.id)
                    elif participant.actor_type == ActorType.USER:
                        user_ids.add(participant.id)
                    combined_participants_by_provider[provider].add(participant)

        if not (team_ids or user_ids):
            return

        logger.info(
            "mail.adapter.notify_digest",
            extra={
                "project_id": self.project.id,
                "target_type": self.target_type.value,
                "target_identifier": self.target_identifier,
                "team_ids": team_ids,
                "user_ids": user_ids,
                "notification_uuid": self.notification_uuid,
            },
        )

        # Calculate the per-participant context.
        extra_context: Mapping[RpcActor, Mapping[str, Any]] = {}
        personalized_digests = should_get_personalized_digests(self.target_type, self.project.id)

        if personalized_digests:
            extra_context = self.get_extra_context(participants_by_provider_by_event)

        for provider, participants in combined_participants_by_provider.items():
            if personalized_digests:
                # remove participants if the digest is empty
                participants_to_remove = set()
                for participant in participants:
                    if participant not in extra_context:
                        participants_to_remove.add(participant)
                participants -= participants_to_remove
            notify(provider, self, participants, shared_context, extra_context)

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        try:
            alert_id = list(self.digest.keys())[0].id
        except Exception:
            alert_id = None

        return {
            "target_type": self.target_type.value,
            "target_identifier": self.target_identifier,
            "alert_id": alert_id,
            **super().get_log_params(recipient),
        }

    def record_notification_sent(self, recipient: RpcActor, provider: ExternalProviders) -> None:
        super().record_notification_sent(recipient, provider)
        log_params = self.get_log_params(recipient)
        analytics.record(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider=provider.name,
            alert_id=log_params["alert_id"] if log_params["alert_id"] else "",
            alert_type="issue_alert",
            external_id=str(recipient.id),
            notification_uuid=self.notification_uuid,
        )
