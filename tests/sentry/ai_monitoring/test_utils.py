from sentry.ai_monitoring.utils import fetch_conversation_titles
from sentry.testutils.cases import TestCase


class FetchConversationTitlesTest(TestCase):
    def test_returns_empty_for_no_pairs(self) -> None:
        assert fetch_conversation_titles([]) == {}

    def test_returns_title_for_requested_pair(self) -> None:
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Reset my password",
        )

        titles = fetch_conversation_titles([("conv-1", self.project.id)])

        assert titles == {("conv-1", self.project.id): "Reset my password"}

    def test_skips_untitled_rows(self) -> None:
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title=None,
        )

        assert fetch_conversation_titles([("conv-1", self.project.id)]) == {}

    def test_skips_unknown_conversations(self) -> None:
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Reset my password",
        )

        assert fetch_conversation_titles([("conv-2", self.project.id)]) == {}

    def test_does_not_return_pairs_that_were_not_requested(self) -> None:
        """A row matching the queried hashes and projects, but not as a requested pair."""
        other_project = self.create_project(organization=self.organization)

        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Owned by project one",
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Owned by project two",
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-2",
            title="Second conversation",
        )

        # conv-1 is only asked about for self.project, conv-2 only for other_project.
        titles = fetch_conversation_titles(
            [("conv-1", self.project.id), ("conv-2", other_project.id)]
        )

        assert titles == {
            ("conv-1", self.project.id): "Owned by project one",
            ("conv-2", other_project.id): "Second conversation",
        }

    def test_returns_both_projects_when_both_requested(self) -> None:
        other_project = self.create_project(organization=self.organization)

        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Owned by project one",
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Owned by project two",
        )

        titles = fetch_conversation_titles(
            [("conv-1", self.project.id), ("conv-1", other_project.id)]
        )

        assert titles == {
            ("conv-1", self.project.id): "Owned by project one",
            ("conv-1", other_project.id): "Owned by project two",
        }
