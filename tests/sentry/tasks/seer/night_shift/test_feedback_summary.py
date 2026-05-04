from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.tasks.seer.night_shift.cron import run_night_shift_execution
from sentry.tasks.seer.night_shift.feedback_summary import (
    MIN_FEEDBACKS_TO_SUMMARIZE,
    agentic_feedback_summary_strategy,
)
from sentry.tasks.seer.night_shift.feedback_summary_tools import (
    GetFeedbackDetailsSummaryParams,
    GetFeedbackListSummaryParams,
    get_feedback_details_summary_tool,
    get_feedback_list_summary_tool,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


class FakeFeedbackSummaryClient:
    """Stub SeerAgentClient that returns a canned feedback summary artifact."""

    def __init__(self, summary: dict, run_id: int = 77):
        artifact = Artifact(key="feedback_summary", data=summary, reason="test")
        self.run_id = run_id
        self._state = SeerRunState(
            run_id=run_id,
            blocks=[
                MemoryBlock(
                    id="test-block",
                    message=Message(role="assistant"),
                    timestamp="2025-01-01T00:00:00",
                    artifacts=[artifact],
                ),
            ],
            status="completed",
            updated_at="2025-01-01T00:00:00",
        )

    def start_run(self, **kwargs):
        return self.run_id

    def get_run(self, run_id, **kwargs):
        return self._state


def _make_feedback(test_case, project, message: str) -> Group:
    return test_case.create_group(
        project=project,
        type=FeedbackGroup.type_id,
        data={"type": "feedback", "metadata": {"message": message}},
    )


def _seed_feedbacks(test_case, project, count: int) -> list[Group]:
    return [_make_feedback(test_case, project, f"Feedback message #{i}") for i in range(count)]


@django_db_all
class TestAgenticFeedbackSummaryStrategy(TestCase):
    def test_writes_result_row_when_artifact_present(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        _seed_feedbacks(self, project, MIN_FEEDBACKS_TO_SUMMARIZE)

        run = SeerNightShiftRun.objects.create(
            organization=org, extras={"kinds": {"feedback_summary": {"status": "running"}}}
        )

        artifact_payload = {
            "summary": "Most feedback is about login flakiness.",
            "themes": [
                {
                    "title": "Login flakiness",
                    "description": "Users are randomly logged out.",
                    "feedback_group_ids": [],
                }
            ],
            "num_feedbacks_analyzed": MIN_FEEDBACKS_TO_SUMMARIZE,
        }
        fake = FakeFeedbackSummaryClient(artifact_payload, run_id=42)

        with patch(
            "sentry.tasks.seer.night_shift.feedback_summary.SeerAgentClient",
            return_value=fake,
        ):
            agent_run_id = agentic_feedback_summary_strategy(org, run=run)

        assert agent_run_id == 42
        result = SeerNightShiftRunResult.objects.get(run=run, kind="feedback_summary")
        assert result.group_id is None
        assert result.seer_run_id == "42"
        assert result.extras["summary"] == artifact_payload["summary"]
        assert result.extras["agent_run_id"] == 42
        assert "feedback_group_ids_sampled" in result.extras

    def test_skipped_when_insufficient_feedbacks(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        _seed_feedbacks(self, project, 3)

        run = SeerNightShiftRun.objects.create(organization=org, extras={"kinds": {}})

        mock_client = MagicMock()
        with patch(
            "sentry.tasks.seer.night_shift.feedback_summary.SeerAgentClient",
            return_value=mock_client,
        ):
            agent_run_id = agentic_feedback_summary_strategy(org, run=run)

        assert agent_run_id is None
        mock_client.start_run.assert_not_called()
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()

    def test_no_artifact_returns_run_id_without_writing_row(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        _seed_feedbacks(self, project, MIN_FEEDBACKS_TO_SUMMARIZE)

        run = SeerNightShiftRun.objects.create(organization=org, extras={"kinds": {}})

        empty_state = SeerRunState(
            run_id=99,
            blocks=[
                MemoryBlock(
                    id="b",
                    message=Message(role="assistant"),
                    timestamp="2025-01-01T00:00:00",
                    artifacts=[],
                )
            ],
            status="completed",
            updated_at="2025-01-01T00:00:00",
        )

        class _StubClient:
            def start_run(self, **kwargs):
                return 99

            def get_run(self, run_id, **kwargs):
                return empty_state

        with patch(
            "sentry.tasks.seer.night_shift.feedback_summary.SeerAgentClient",
            return_value=_StubClient(),
        ):
            agent_run_id = agentic_feedback_summary_strategy(org, run=run)

        assert agent_run_id == 99
        assert not SeerNightShiftRunResult.objects.filter(run=run).exists()


@django_db_all
class TestFeedbackSummaryTools(TestCase):
    def test_list_returns_recent_feedbacks_for_org(self) -> None:
        project = self.create_project()
        _seed_feedbacks(self, project, 3)

        out = get_feedback_list_summary_tool.execute(
            self.organization, GetFeedbackListSummaryParams()
        )
        assert "Found 3 feedback entries" in out
        assert f"project={project.slug}" in out

    def test_list_excludes_other_org_feedbacks(self) -> None:
        own_project = self.create_project()
        _seed_feedbacks(self, own_project, 2)

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        _seed_feedbacks(self, other_project, 5)

        out = get_feedback_list_summary_tool.execute(
            self.organization, GetFeedbackListSummaryParams()
        )
        assert f"project={own_project.slug}" in out
        assert f"project={other_project.slug}" not in out

    def test_list_skips_feedbacks_outside_lookback(self) -> None:
        project = self.create_project()
        groups = _seed_feedbacks(self, project, 3)
        # Force first_seen well outside the lookback window.
        Group.objects.filter(id__in=[g.id for g in groups]).update(
            first_seen=timezone.now() - timedelta(days=30)
        )

        out = get_feedback_list_summary_tool.execute(
            self.organization, GetFeedbackListSummaryParams()
        )
        assert "No feedback found in the lookback window." in out

    def test_details_blocks_cross_org_lookup(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        foreign = _seed_feedbacks(self, other_project, 1)[0]

        out = get_feedback_details_summary_tool.execute(
            self.organization,
            GetFeedbackDetailsSummaryParams(feedback_group_id=foreign.id),
        )
        assert "Feedback not found." in out


@django_db_all
class TestRunNightShiftExecutionFeedbackBranch(TestCase):
    def test_dispatches_feedback_summary_strategy(self) -> None:
        org = self.create_organization()
        run = SeerNightShiftRun.objects.create(
            organization=org,
            extras={"kinds": {"feedback_summary": {"status": "pending"}}},
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.quotas.backend.check_seer_quota",
                return_value=True,
            ),
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_feedback_summary_strategy",
                return_value=42,
            ) as mock_strategy,
        ):
            run_night_shift_execution(run.id, kind="feedback_summary")

        mock_strategy.assert_called_once()
        run.refresh_from_db()
        assert run.extras["kinds"]["feedback_summary"]["status"] == "succeeded"
        assert run.extras["kinds"]["feedback_summary"]["agent_run_id"] == 42

    def test_skipped_status_when_strategy_returns_none(self) -> None:
        org = self.create_organization()
        run = SeerNightShiftRun.objects.create(
            organization=org,
            extras={"kinds": {"feedback_summary": {"status": "pending"}}},
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift.cron.quotas.backend.check_seer_quota",
                return_value=True,
            ),
            patch(
                "sentry.tasks.seer.night_shift.cron.agentic_feedback_summary_strategy",
                return_value=None,
            ),
        ):
            run_night_shift_execution(run.id, kind="feedback_summary")

        run.refresh_from_db()
        state = run.extras["kinds"]["feedback_summary"]
        assert state["status"] == "skipped"
        assert state["reason"] == "insufficient_feedbacks"
