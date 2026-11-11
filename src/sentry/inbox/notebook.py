from collections.abc import Sequence
from dataclasses import dataclass

from sentry import features
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import SYSTEM_ACTOR, InboxEventData, InboxEventType, InboxItemType
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notebooks.access import INVESTIGATION_SCOPES, has_investigations_access
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
NOTEBOOK_USER_MENTIONED = InboxEventType(
    event_type="notebook.user_mentioned", item_type=NOTEBOOK, data_class=NotebookMentionedData
)
NOTEBOOK_TEAM_MENTIONED = InboxEventType(
    event_type="notebook.team_mentioned", item_type=NOTEBOOK, data_class=NotebookMentionedData
)
NOTEBOOK_PARTICIPANT_ADDED = InboxEventType(
    event_type="notebook.participant_added",
    item_type=NOTEBOOK,
    data_class=NotebookParticipantAddedData,
)

inbox_item_event_type_registry.register(NOTEBOOK_COMPLETED.event_type)(NOTEBOOK_COMPLETED)
inbox_item_event_type_registry.register(NOTEBOOK_USER_MENTIONED.event_type)(NOTEBOOK_USER_MENTIONED)
inbox_item_event_type_registry.register(NOTEBOOK_TEAM_MENTIONED.event_type)(NOTEBOOK_TEAM_MENTIONED)
inbox_item_event_type_registry.register(NOTEBOOK_PARTICIPANT_ADDED.event_type)(
    NOTEBOOK_PARTICIPANT_ADDED
)


def record_notebook_completed(*, notebook: Notebook, seer_run_id: int) -> None:
    user_id = notebook.created_by_id
    if user_id is None:
        return
    organization = notebook.organization
    if not features.has(
        "organizations:universal-inbox-recording", organization
    ) or not has_investigations_access(organization):
        return
    member = OrganizationMember.objects.filter(
        organization_id=notebook.organization_id,
        user_id=user_id,
        user_is_active=True,
    ).first()
    if member is None or not member.get_scopes() & INVESTIGATION_SCOPES:
        return
    NOTEBOOK_COMPLETED.record(
        subject=notebook,
        data=NotebookCompletedData(summary="Investigation completed", seer_run_id=seer_run_id),
        recipient_user_ids=[user_id],
        actor=SYSTEM_ACTOR,
    )
