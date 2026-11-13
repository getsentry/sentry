from collections.abc import Sequence
from dataclasses import dataclass

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData, InboxEventSummary, InboxEventType, InboxItemType
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notebooks.access import NOTEBOOK_SCOPES, has_notebooks_access
from sentry.notebooks.models import Notebook
from sentry.notifications.types import NotificationSettingEnum


class NotebookItemType(InboxItemType[Notebook]):
    subject_type = "notebook"

    def get_subject_id(self, subject: Notebook) -> str:
        return str(subject.id)

    def get_organization_id(self, subject: Notebook) -> int:
        return subject.organization_id

    def get_titles(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, str]:
        ids = [int(subject_id) for subject_id in subject_ids if subject_id.isdecimal()]
        notebooks = Notebook.objects.filter(organization=organization, id__in=ids)
        return {str(notebook.id): notebook.title for notebook in notebooks}

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        return organization.absolute_url(
            f"/organizations/{organization.slug}/seer/investigations/{subject_id}/"
        )

    def filter_recipients(self, *, subject: Notebook, user_ids: Sequence[int]) -> list[int]:
        if not user_ids or not has_notebooks_access(subject.organization):
            return []
        members = OrganizationMember.objects.filter(
            organization_id=subject.organization_id, user_id__in=user_ids, user_is_active=True
        )
        return [
            member.user_id
            for member in members
            if member.user_id is not None and member.get_scopes() & NOTEBOOK_SCOPES
        ]


@dataclass(frozen=True, kw_only=True)
class NotebookCompletedData(InboxEventData):
    seer_run_id: int  # Seer DbRunState ID, matching issue inbox events.


@dataclass(frozen=True, kw_only=True)
class NotebookMentionedData(InboxEventData):
    comment_id: int
    block_id: int | None = None


@dataclass(frozen=True, kw_only=True)
class NotebookParticipantAddedData(InboxEventData):
    pass


NOTEBOOK = NotebookItemType()
inbox_item_type_registry.register(NOTEBOOK.subject_type)(NOTEBOOK)

NOTEBOOK_COMPLETED = InboxEventType(
    event_type="notebook.completed",
    summary=InboxEventSummary.NOTEBOOK_COMPLETED,
    item_type=NOTEBOOK,
    data_class=NotebookCompletedData,
    notification_setting=NotificationSettingEnum.INBOX_COMPLETION_STATUS,
)
NOTEBOOK_USER_MENTIONED = InboxEventType(
    event_type="notebook.user_mentioned",
    summary=InboxEventSummary.NOTEBOOK_MENTIONED,
    item_type=NOTEBOOK,
    data_class=NotebookMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
)
NOTEBOOK_TEAM_MENTIONED = InboxEventType(
    recipient="team",
    event_type="notebook.team_mentioned",
    summary=InboxEventSummary.NOTEBOOK_TEAM_MENTIONED,
    item_type=NOTEBOOK,
    data_class=NotebookMentionedData,
    notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
)
NOTEBOOK_PARTICIPANT_ADDED = InboxEventType(
    event_type="notebook.participant_added",
    summary=InboxEventSummary.NOTEBOOK_PARTICIPANT_ADDED,
    item_type=NOTEBOOK,
    data_class=NotebookParticipantAddedData,
    notification_setting=NotificationSettingEnum.INBOX_ASSIGNMENTS,
)

inbox_item_event_type_registry.register(NOTEBOOK_COMPLETED.event_type)(NOTEBOOK_COMPLETED)
inbox_item_event_type_registry.register(NOTEBOOK_USER_MENTIONED.event_type)(NOTEBOOK_USER_MENTIONED)
inbox_item_event_type_registry.register(NOTEBOOK_TEAM_MENTIONED.event_type)(NOTEBOOK_TEAM_MENTIONED)
inbox_item_event_type_registry.register(NOTEBOOK_PARTICIPANT_ADDED.event_type)(
    NOTEBOOK_PARTICIPANT_ADDED
)
