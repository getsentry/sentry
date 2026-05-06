from datetime import datetime, timedelta

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.base import TimeSeriesValue
from sentry.rules.history.endpoints.project_rule_stats import TimeSeriesValueSerializer
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import AlertRuleWorkflow

pytestmark = [requires_snuba]


@control_silo_test
class TimeSeriesValueSerializerTest(TestCase):
    def test(self) -> None:
        time_series_value = TimeSeriesValue(datetime.now(), 30)
        result = serialize([time_series_value], self.user, TimeSeriesValueSerializer())
        assert result == [
            {
                "date": time_series_value.bucket,
                "count": time_series_value.count,
            }
        ]


@freeze_time()
class ProjectRuleStatsIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-stats-index"

    def test(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        rule_2 = self.create_project_rule(project=self.event.project)
        history = []

        for i in range(3):
            for _ in range(i + 1):
                history.append(
                    RuleFireHistory(
                        project=rule.project,
                        rule=rule,
                        group=self.group,
                        date_added=before_now(hours=i + 1),
                    )
                )

        for i in range(2):
            history.append(
                RuleFireHistory(
                    project=rule_2.project,
                    rule=rule_2,
                    group=self.group,
                    date_added=before_now(hours=i + 1),
                )
            )

        RuleFireHistory.objects.bulk_create(history)
        self.login_as(self.user)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=before_now(days=6),
            end=before_now(days=0),
        )
        assert len(resp.data) == 144
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        assert [r for r in resp.data[-4:]] == [
            {"date": now - timedelta(hours=3), "count": 3},
            {"date": now - timedelta(hours=2), "count": 2},
            {"date": now - timedelta(hours=1), "count": 1},
            {"date": now, "count": 0},
        ]

    def test_shared_workflow_across_projects(self) -> None:
        project_a = self.project
        project_b = self.create_project(organization=self.organization)
        rule_a = self.create_project_rule(project=project_a)
        rule_b = self.create_project_rule(project=project_b)

        # Simulate the bug: point both rules at the same Workflow
        arw_a = AlertRuleWorkflow.objects.get(rule_id=rule_a.id)
        shared_workflow = arw_a.workflow
        arw_b = AlertRuleWorkflow.objects.get(rule_id=rule_b.id)
        arw_b.workflow = shared_workflow
        arw_b.save()

        self.login_as(self.user)
        # This would crash with MultipleObjectsReturned without the project_id fix
        self.get_success_response(
            self.organization.slug,
            project_a.slug,
            rule_a.id,
            start=before_now(days=1),
            end=before_now(days=0),
        )

    def test_invalid_date_range(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        self.login_as(self.user)
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start="invalid",
            status_code=400,
        )
