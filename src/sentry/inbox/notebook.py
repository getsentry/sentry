from collections.abc import Sequence
from dataclasses import dataclass

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData, InboxEventType, InboxItemType
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook


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
    event_type="notebook.completed", item_type=NOTEBOOK, data_class=NotebookCompletedData
)
NOTEBOOK_MENTIONED = InboxEventType(
    event_type="notebook.mentioned", item_type=NOTEBOOK, data_class=NotebookMentionedData
)
NOTEBOOK_PARTICIPANT_ADDED = InboxEventType(
    event_type="notebook.participant_added",
    item_type=NOTEBOOK,
    data_class=NotebookParticipantAddedData,
)

inbox_item_event_type_registry.register(NOTEBOOK_COMPLETED.event_type)(NOTEBOOK_COMPLETED)
inbox_item_event_type_registry.register(NOTEBOOK_MENTIONED.event_type)(NOTEBOOK_MENTIONED)
inbox_item_event_type_registry.register(NOTEBOOK_PARTICIPANT_ADDED.event_type)(
    NOTEBOOK_PARTICIPANT_ADDED
)
