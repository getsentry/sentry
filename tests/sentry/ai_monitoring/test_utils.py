from datetime import UTC, datetime

from sentry.ai_monitoring.utils import fetch_conversation_title, fetch_conversation_titles
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

        assert titles == {"conv-1": "Reset my password"}

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
            "conv-1": "Owned by project one",
            "conv-2": "Second conversation",
        }

    def test_earliest_source_timestamp_wins(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Later half of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 12, 0, tzinfo=UTC),
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Start of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 11, 0, tzinfo=UTC),
        )

        titles = fetch_conversation_titles(
            [("conv-1", self.project.id), ("conv-1", other_project.id)]
        )

        assert titles == {"conv-1": "Start of the conversation"}

    def test_null_source_timestamp_loses(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Unknown when this started",
            title_source_timestamp=None,
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Start of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 11, 0, tzinfo=UTC),
        )

        titles = fetch_conversation_titles(
            [("conv-1", self.project.id), ("conv-1", other_project.id)]
        )

        assert titles == {"conv-1": "Start of the conversation"}

    def test_ties_break_on_project_id(self) -> None:
        source_timestamp = datetime(2024, 5, 1, tzinfo=UTC)
        lower_project, higher_project = sorted(
            (
                self.create_project(organization=self.organization),
                self.create_project(organization=self.organization),
            ),
            key=lambda project: project.id,
        )

        self.create_ai_conversation_metadata(
            project=lower_project,
            conversation_id="conv-1",
            title="Lower project id",
            title_source_timestamp=source_timestamp,
        )
        self.create_ai_conversation_metadata(
            project=higher_project,
            conversation_id="conv-1",
            title="Higher project id",
            title_source_timestamp=source_timestamp,
        )

        titles = fetch_conversation_titles(
            [("conv-1", lower_project.id), ("conv-1", higher_project.id)]
        )

        assert titles == {"conv-1": "Lower project id"}

    def test_unrequested_earlier_title_does_not_win(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Requested project title",
            title_source_timestamp=datetime(2024, 5, 1, 12, 0, tzinfo=UTC),
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Earlier but unrequested",
            title_source_timestamp=datetime(2024, 5, 1, 11, 0, tzinfo=UTC),
        )

        titles = fetch_conversation_titles([("conv-1", self.project.id)])

        assert titles == {"conv-1": "Requested project title"}


class FetchConversationTitleTest(TestCase):
    def test_returns_none_without_projects(self) -> None:
        assert fetch_conversation_title("conv-1", []) is None

    def test_returns_none_when_conversation_is_unknown(self) -> None:
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Reset my password",
        )

        assert fetch_conversation_title("conv-2", [self.project.id]) is None

    def test_returns_stored_title(self) -> None:
        source_timestamp = datetime(2024, 5, 1, tzinfo=UTC)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Reset my password",
            title_source_timestamp=source_timestamp,
        )

        stored = fetch_conversation_title("conv-1", [self.project.id])

        assert stored is not None
        assert stored.project_id == self.project.id
        assert stored.title == "Reset my password"
        assert stored.title_source_timestamp == source_timestamp

    def test_skips_untitled_rows(self) -> None:
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title=None,
        )

        assert fetch_conversation_title("conv-1", [self.project.id]) is None

    def test_ignores_projects_that_were_not_requested(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Owned by project two",
        )

        assert fetch_conversation_title("conv-1", [self.project.id]) is None

    def test_earliest_source_timestamp_wins(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Later half of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 12, 0, tzinfo=UTC),
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Start of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 11, 0, tzinfo=UTC),
        )

        stored = fetch_conversation_title("conv-1", [self.project.id, other_project.id])

        assert stored is not None
        assert stored.project_id == other_project.id
        assert stored.title == "Start of the conversation"

    def test_rows_without_source_timestamp_lose(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Unknown when this started",
            title_source_timestamp=None,
        )
        self.create_ai_conversation_metadata(
            project=other_project,
            conversation_id="conv-1",
            title="Start of the conversation",
            title_source_timestamp=datetime(2024, 5, 1, 11, 0, tzinfo=UTC),
        )

        stored = fetch_conversation_title("conv-1", [self.project.id, other_project.id])

        assert stored is not None
        assert stored.title == "Start of the conversation"

    def test_falls_back_to_row_without_source_timestamp(self) -> None:
        row = self.create_ai_conversation_metadata(
            project=self.project,
            conversation_id="conv-1",
            title="Unknown when this started",
            title_source_timestamp=None,
        )
        assert row.title_source_timestamp is None

        stored = fetch_conversation_title("conv-1", [self.project.id])

        assert stored is not None
        assert stored.title == "Unknown when this started"

    def test_ties_break_on_project_id(self) -> None:
        source_timestamp = datetime(2024, 5, 1, tzinfo=UTC)
        lower_project, higher_project = sorted(
            (
                self.create_project(organization=self.organization),
                self.create_project(organization=self.organization),
            ),
            key=lambda project: project.id,
        )

        self.create_ai_conversation_metadata(
            project=lower_project,
            conversation_id="conv-1",
            title="Lower project id",
            title_source_timestamp=source_timestamp,
        )
        self.create_ai_conversation_metadata(
            project=higher_project,
            conversation_id="conv-1",
            title="Higher project id",
            title_source_timestamp=source_timestamp,
        )

        stored = fetch_conversation_title("conv-1", [lower_project.id, higher_project.id])

        assert stored is not None
        assert stored.project_id == lower_project.id
