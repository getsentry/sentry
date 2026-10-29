from collections.abc import Sequence
from dataclasses import dataclass
from typing import assert_type
from unittest.mock import patch

from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import (
    SYSTEM_ACTOR,
    InboxActor,
    InboxEventData,
    InboxEventType,
    InboxItemType,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitemevent import InboxActorType


class StubItemType[SubjectT](InboxItemType[SubjectT]):
    def __init__(self, subject_type: str) -> None:
        self.subject_type = subject_type

    def get_subject_id(self, subject: SubjectT) -> str:
        raise NotImplementedError

    def get_organization_id(self, subject: SubjectT) -> int:
        raise NotImplementedError

    def get_titles(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, str]:
        raise NotImplementedError

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        raise NotImplementedError


@dataclass(frozen=True, kw_only=True)
class SubjectReference:
    organization_id: int
    subject_id: str


@dataclass(frozen=True, kw_only=True)
class MentionedData(InboxEventData):
    comment_id: int


@patch.dict(inbox_item_type_registry.registrations, clear=True)
@patch.dict(inbox_item_event_type_registry.registrations, clear=True)
def test_register_types() -> None:
    issue_type = StubItemType[Group]("test.issue")
    reference_type = StubItemType[SubjectReference]("test.reference")
    issue_event = InboxEventType(
        event_type="test.issue.mentioned",
        item_type=issue_type,
        data_class=MentionedData,
    )
    reference_event = InboxEventType(
        event_type="test.reference.mentioned",
        item_type=reference_type,
        data_class=MentionedData,
    )
    assert_type(issue_event, InboxEventType[Group, MentionedData])
    assert_type(reference_event, InboxEventType[SubjectReference, MentionedData])
    data = issue_event.data_class(summary="You were mentioned in a comment", comment_id=123)
    assert_type(data, MentionedData)

    inbox_item_type_registry.register(issue_type.subject_type)(issue_type)
    inbox_item_type_registry.register(reference_type.subject_type)(reference_type)
    inbox_item_event_type_registry.register(issue_event.event_type)(issue_event)
    inbox_item_event_type_registry.register(reference_event.event_type)(reference_event)

    assert inbox_item_type_registry.get(issue_type.subject_type) is issue_type
    assert inbox_item_type_registry.get(reference_type.subject_type) is reference_type
    assert inbox_item_event_type_registry.get(issue_event.event_type) is issue_event
    assert inbox_item_event_type_registry.get(reference_event.event_type) is reference_event


def test_actor() -> None:
    assert InboxActor.user(123) == InboxActor(type=InboxActorType.USER, id=123)
    assert SYSTEM_ACTOR == InboxActor(type=InboxActorType.SYSTEM, id=None)
