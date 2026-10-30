import pytest

from sentry.inbox.issue import (
    ISSUE,
    IssueAssignedData,
    IssueMentionedData,
    IssuePRReadyForReviewData,
)
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData
from sentry.testutils.cases import TestCase


class IssueItemTypeTest(TestCase):
    def test_identity(self) -> None:
        group = self.create_group(project=self.project)

        assert inbox_item_type_registry.get("issue") is ISSUE
        assert ISSUE.get_subject_id(group) == str(group.id)
        assert ISSUE.get_organization_id(group) == self.organization.id

    def test_titles(self) -> None:
        first = self.create_group(project=self.project, data={"title": "First issue"})
        second = self.create_group(project=self.project, data={"title": "Second issue"})
        other = self.create_group(
            project=self.create_project(organization=self.create_organization()),
            data={"title": "Other organization"},
        )
        deleted = self.create_group(project=self.project)
        deleted_id = str(deleted.id)
        deleted.delete()

        with self.assertNumQueries(1):
            titles = ISSUE.get_titles(
                organization=self.organization,
                subject_ids=[str(first.id), str(second.id), str(other.id), deleted_id, "invalid"],
            )

        assert titles == {str(first.id): "First issue", str(second.id): "Second issue"}

    def test_url(self) -> None:
        organization = self.organization
        expected = organization.absolute_url(f"/organizations/{organization.slug}/issues/123/")

        with self.assertNumQueries(0):
            assert ISSUE.get_url(organization=organization, subject_id="123") == expected


@pytest.mark.parametrize(
    "event_type, data_class",
    [
        ("issue.assigned", IssueAssignedData),
        ("issue.mentioned", IssueMentionedData),
        ("issue.pr_ready_for_review", IssuePRReadyForReviewData),
    ],
)
def test_event_types(event_type: str, data_class: type[InboxEventData]) -> None:
    event = inbox_item_event_type_registry.get(event_type)

    assert event.item_type is ISSUE
    assert event.data_class is data_class
