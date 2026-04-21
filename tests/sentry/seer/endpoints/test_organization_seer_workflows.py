from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunIssue
from sentry.testutils.cases import APITestCase


class OrganizationSeerWorkflowsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-workflows"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_flag_disabled_returns_404(self) -> None:
        SeerNightShiftRun.objects.create(
            organization=self.organization,
            triage_strategy="agentic",
        )
        self.get_error_response(self.organization.slug, status_code=404)

    def test_returns_runs_for_org_with_nested_issues(self) -> None:
        group = self.create_group()
        run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            triage_strategy="agentic",
            extras={"foo": "bar"},
        )
        issue = SeerNightShiftRunIssue.objects.create(
            run=run,
            group=group,
            action="autofix_triggered",
            seer_run_id="seer-123",
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(run.id)
        assert response.data[0]["triageStrategy"] == "agentic"
        assert response.data[0]["errorMessage"] is None
        assert response.data[0]["extras"] == {"foo": "bar"}
        assert len(response.data[0]["issues"]) == 1

        issue_data = response.data[0]["issues"][0]
        assert issue_data["id"] == str(issue.id)
        assert issue_data["groupId"] == str(group.id)
        assert issue_data["action"] == "autofix_triggered"
        assert issue_data["seerRunId"] == "seer-123"

    def test_runs_ordered_by_date_added_desc(self) -> None:
        older = SeerNightShiftRun.objects.create(
            organization=self.organization,
            triage_strategy="agentic",
        )
        newer = SeerNightShiftRun.objects.create(
            organization=self.organization,
            triage_strategy="simple",
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert [r["id"] for r in response.data] == [str(newer.id), str(older.id)]

    def test_runs_scoped_to_requesting_org(self) -> None:
        other_org = self.create_organization()
        SeerNightShiftRun.objects.create(
            organization=other_org,
            triage_strategy="agentic",
        )
        own_run = SeerNightShiftRun.objects.create(
            organization=self.organization,
            triage_strategy="agentic",
        )

        with self.feature("organizations:seer-night-shift"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(own_run.id)
