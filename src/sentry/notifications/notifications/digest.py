from __future__ import annotations

import logging
from collections import defaultdict
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence

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
from sentry.notifications.types import ActionTargetType
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
from sentry.types.integrations import ExternalProviders
from sentry.utils.dates import to_timestamp

if TYPE_CHECKING:
    from sentry.models import Organization, Project, Team, User

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
    ) -> None:
        super().__init__(project)
        self.digest = digest
        self.target_type = target_type
        self.target_identifier = target_identifier

    def get_unsubscribe_key(self) -> tuple[str, int, str | None] | None:
        return "project", self.project.id, "alert_digest"

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        if not context:
            # This shouldn't be possible but adding a message just in case.
            return "Digest Report"

        return get_digest_subject(context["group"], context["counts"], context["start"])

    def get_notification_title(self, context: Mapping[str, Any] | None = None) -> str:
        if not context:
            return "Digest Report"

        return "<!date^{:.0f}^{count} {noun} detected {date} in| Digest Report for> <{project_link}|{project_name}>".format(
            to_timestamp(context["start"]),
            count=len(context["counts"]),
            noun="issue" if len(context["counts"]) == 1 else "issues",
            project_link=f'https://sentry.io/organizations/{context["group"].project.organization.slug}/projects/{context["group"].project.slug}/',
            project_name=context["group"].project.name,
            date="{date_pretty}",
        )

    def get_title_link(self, recipient: Team | User) -> str | None:
        return None

    def build_attachment_title(self, recipient: Team | User) -> str:
        return ""

    @property
    def reference(self) -> Model | None:
        return self.project

    def get_context(self) -> MutableMapping[str, Any]:
        return DigestNotification.build_context(
            self.digest,
            self.project,
            self.project.organization,
            get_rules(list(self.digest.keys()), self.project.organization, self.project),
        )

    @staticmethod
    def build_context(
        digest: Digest,
        project: Project,
        organization: Organization,
        rule_details: Sequence[NotificationRuleDetails],
        alert_timestamp: int | None = None,
    ) -> MutableMapping[str, Any]:
        return {
            **get_digest_as_context(digest),
            "has_alert_integration": has_alert_integration(project),
            "project": project,
            "slack_link": get_integration_link(organization, "slack"),
            "rules_details": {rule.id: rule for rule in rule_details},
            "link_params_for_rule": get_email_link_extra_params(
                "digest_email", None, rule_details, alert_timestamp
            ),
        }

    def get_extra_context(
        self,
        participants_by_provider_by_event: Mapping[
            Event, Mapping[ExternalProviders, set[Team | User]]
        ],
    ) -> Mapping[int, Mapping[str, Any]]:
        personalized_digests = get_personalized_digests(
            self.digest, participants_by_provider_by_event
        )
        return {
            actor_id: get_digest_as_context(digest)
            for actor_id, digest in personalized_digests.items()
        }

    def send(self) -> None:
        # Only calculate shared context once.
        shared_context = self.get_context()

        if should_send_as_alert_notification(shared_context):
            return send_as_alert_notification(
                shared_context, self.target_type, self.target_identifier
            )

        participants_by_provider_by_event = get_participants_by_event(
            self.digest,
            self.project,
            self.target_type,
            self.target_identifier,
        )

        # Get every actor ID for every provider as a set.
        actor_ids = set()
        combined_participants_by_provider = defaultdict(set)
        for participants_by_provider in participants_by_provider_by_event.values():
            for provider, participants in participants_by_provider.items():
                for participant in participants:
                    actor_ids.add(participant.actor_id)
                    combined_participants_by_provider[provider].add(participant)

        if not actor_ids:
            return

        logger.info(
            "mail.adapter.notify_digest",
            extra={
                "project_id": self.project.id,
                "target_type": self.target_type.value,
                "target_identifier": self.target_identifier,
                "actor_ids": actor_ids,
            },
        )

        # Calculate the per-participant context.
        extra_context: Mapping[int, Mapping[str, Any]] = {}
        if should_get_personalized_digests(self.target_type, self.project.id):
            extra_context = self.get_extra_context(participants_by_provider_by_event)

        for provider, participants in combined_participants_by_provider.items():
            notify(provider, self, participants, shared_context, extra_context)
