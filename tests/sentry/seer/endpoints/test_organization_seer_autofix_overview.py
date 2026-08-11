from unittest import mock

from sentry.seer.milestones import reconcile_milestones
from sentry.seer.models.run import SeerRunMilestoneType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.group import PriorityLevel


def _root_cause_state(description):
    from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState

    return SeerRunState(
        run_id=1,
        blocks=[
            MemoryBlock(
                id="b",
                message=Message(role="assistant", content="c"),
                timestamp="2026-02-10T00:00:00Z",
                artifacts=[
                    Artifact(
                        key="root_cause", data={"one_line_description": description}, reason="r"
                    )
                ],
            )
        ],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
    )


class OrganizationSeerAutofixOverviewTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-autofix-overview"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _run_for_group(self, group, description):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, _root_cause_state(description))
        return run

    def test_feature_flag_off_returns_404(self):
        self.get_error_response(self.organization.slug, status_code=404)

    def test_root_cause_run_grouped_under_root_cause_milestone(self):
        group = self.create_group()
        self._run_for_group(group, "the boom")
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["shortId"] == group.qualified_short_id
        assert runs[0]["rootCause"]["oneLineDescription"] == "the boom"
        assert runs[0]["proposedFix"] is None

    def _solution_state(self, rc, sol):
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState

        return SeerRunState(
            run_id=1,
            blocks=[
                MemoryBlock(
                    id="b",
                    message=Message(role="assistant", content="c"),
                    timestamp="2026-02-10T00:00:00Z",
                    artifacts=[
                        Artifact(key="root_cause", data={"one_line_description": rc}, reason="r"),
                        Artifact(key="solution", data={"one_line_summary": sol}, reason="r"),
                    ],
                )
            ],
            status="completed",
            updated_at="2026-02-10T00:00:00Z",
        )

    def test_solution_run_grouped_under_solution_milestone_with_both_texts(self):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", group=group, project=group.project)
        reconcile_milestones(run, self._solution_state("rc text", "fix text"))
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        runs_by_milestone = resp.data["runsByMilestone"]
        assert runs_by_milestone[SeerRunMilestoneType.ROOT_CAUSE] == []
        runs = runs_by_milestone[SeerRunMilestoneType.SOLUTION]
        assert len(runs) == 1
        assert runs[0]["rootCause"]["oneLineDescription"] == "rc text"
        assert runs[0]["proposedFix"]["oneLineSummary"] == "fix text"

    def test_only_latest_run_per_group_is_shown(self):
        group = self.create_group()
        self._run_for_group(group, "old run")
        self._run_for_group(group, "new run")
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert len(runs) == 1
        assert runs[0]["rootCause"]["oneLineDescription"] == "new run"

    def test_inaccessible_project_is_excluded(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)
        run = self.create_seer_run(organization=other_org)
        self.create_seer_agent_run(run, source="autofix", group=other_group, project=other_project)
        reconcile_milestones(run, _root_cause_state("hidden"))
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        assert resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE] == []

    def test_deleted_group_id_is_tolerated(self):
        group = self.create_group()
        self._run_for_group(group, "gone")
        group.delete()
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        # Stale group id points at a deleted group; run is skipped, no 500.
        assert resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE] == []

    def test_run_includes_nested_issue_object(self):
        group = self.create_group(priority=PriorityLevel.HIGH)
        self._run_for_group(group, "the boom")
        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)
        issue = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]["issue"]
        assert issue["project"]["id"] == str(group.project_id)
        assert issue["project"]["slug"] == group.project.slug
        assert issue["priority"] == "high"
        assert "count" in issue
        assert "userCount" in issue
        assert "lastSeen" in issue
        assert issue["assignedTo"] is None
        assert issue["owners"] == []

    def test_runs_outside_stats_period_are_excluded(self):
        recent = self.create_group()
        self._run_for_group(recent, "recent boom")
        old = self.create_group()
        old_run = self._run_for_group(old, "old boom")
        old_run.update(last_triggered_at=before_now(days=30))

        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(
                self.organization.slug, qs_params={"statsPeriod": "14d"}
            )

        runs = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]
        assert [r["shortId"] for r in runs] == [recent.qualified_short_id]

    @mock.patch(
        "sentry.seer.endpoints.organization_seer_autofix_overview._MAX_RUNS_PER_MILESTONE", 2
    )
    def test_section_is_capped_at_max_runs_per_milestone(self):
        for i in range(3):
            self._run_for_group(self.create_group(), f"boom {i}")

        with self.feature("organizations:seer-night-shift-ui"):
            resp = self.get_success_response(self.organization.slug)

        assert len(resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE]) == 2
