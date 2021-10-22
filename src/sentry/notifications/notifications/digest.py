import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Optional, Tuple, Union

from sentry.digests import Digest
from sentry.digests.utilities import (
    get_digest_metadata,
    get_personalized_digests,
    should_get_personalized_digests,
)
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import notify
from sentry.notifications.types import ActionTargetType
from sentry.notifications.utils import get_integration_link, has_alert_integration
from sentry.notifications.utils.digest import (
    get_digest_subject,
    send_as_alert_notification,
    should_send_as_alert_notification,
)
from sentry.notifications.utils.participants import get_send_to
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Project, Team, User


logger = logging.getLogger(__name__)


class DigestNotification(BaseNotification):
    def __init__(
        self,
        project: "Project",
        digest: Digest,
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
    ) -> None:
        super().__init__(project)
        self.digest = digest
        self.target_type = target_type
        self.target_identifier = target_identifier

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        return get_send_to(
            project=self.project,
            target_type=self.target_type,
            target_identifier=self.target_identifier,
        )

    def get_filename(self) -> str:
        return "digests/body"

    def get_category(self) -> str:
        return "digest_email"

    def get_type(self) -> str:
        return "notify.digest"

    def get_unsubscribe_key(self) -> Optional[Tuple[str, int, Optional[str]]]:
        return "project", self.project.id, "alert_digest"

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        if not context:
            # This shouldn't be possible but adding a message just in case.
            return "Digest Report"
        return get_digest_subject(context["group"], context["counts"], context["start"])

    def get_notification_title(self) -> str:
        # This shouldn't be possible but adding a message just in case.
        return "Digest Report"

    def get_reference(self) -> Any:
        return self.project

    def get_context(self) -> MutableMapping[str, Any]:
        start, end, counts = get_digest_metadata(self.digest)
        group = next(iter(counts))
        return {
            "counts": counts,
            "digest": self.digest,
            "end": end,
            "group": group,
            "has_alert_integration": has_alert_integration(self.project),
            "project": self.project,
            "slack_link": get_integration_link(self.organization, "slack"),
            "start": start,
        }

    def get_extra_context(self, recipient_ids: Iterable[int]) -> Mapping[int, Mapping[str, Any]]:
        extra_context = {}
        for user_id, digest in get_personalized_digests(
            self.target_type, self.project.id, self.digest, recipient_ids
        ):
            start, end, counts = get_digest_metadata(digest)
            group = next(iter(counts))

            extra_context[user_id] = {
                "counts": counts,
                "digest": digest,
                "group": group,
                "end": end,
                "start": start,
            }

        return extra_context

    def send(self) -> None:
        if not self.should_email():
            return

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            return

        # Get every user ID for every provider as a set.
        user_ids = {user.id for users in participants_by_provider.values() for user in users}

        logger.info(
            "mail.adapter.notify_digest",
            extra={
                "project_id": self.project.id,
                "target_type": self.target_type.value,
                "target_identifier": self.target_identifier,
                "user_ids": user_ids,
            },
        )

        # Only calculate shared context once.
        shared_context = self.get_context()

        if should_send_as_alert_notification(shared_context):
            return send_as_alert_notification(
                shared_context, self.target_type, self.target_identifier
            )

        # Calculate the per-user context. It's fine that we're doing extra work
        # to get personalized digests for the non-email users.
        extra_context: Mapping[int, Mapping[str, Any]] = {}
        if should_get_personalized_digests(self.target_type, self.project.id):
            extra_context = self.get_extra_context(user_ids)

        for provider, participants in participants_by_provider.items():
            if provider in [ExternalProviders.EMAIL]:
                notify(provider, self, participants, shared_context, extra_context)
