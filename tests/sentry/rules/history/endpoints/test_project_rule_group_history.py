from datetime import datetime

from sentry.api.serializers import serialize
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory
from sentry.rules.history.endpoints.project_rule_group_history import RuleGroupHistorySerializer
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import AlertRuleWorkflow

pytestmark = [requires_snuba]


class RuleGroupHistorySerializerTest(TestCase):
    def test(self) -> None:
        current_date = datetime.now()
        group_history = RuleGroupHistory(self.group, 50, current_date)
        result = serialize([group_history], self.user, RuleGroupHistorySerializer())
        assert result == [
            {
                "group": serialize(self.group, self.user),
                "count": group_history.count,
                "lastTriggered": current_date,
                "eventId": None,
            }
        ]


@freeze_time()
class ProjectRuleGroupHistoryIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-group-history-index"

    def test(self) -> None:
        history = []
        rule = self.create_project_rule()
        for i in range(3):
            history.append(
                RuleFireHistory(
                    project=rule.project,
                    rule=rule,
                    group=self.group,
                    date_added=before_now(days=i + 1),
                )
            )
        group_2 = self.create_group()
        history.append(
            RuleFireHistory(
                project=rule.project, rule=rule, group=group_2, date_added=before_now(days=1)
            )
        )
        self.login_as(self.user)
        RuleFireHistory.objects.bulk_create(history)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=before_now(days=6),
            end=before_now(days=0),
        )
        base_triggered_date = before_now(days=1)
        assert resp.data == serialize(
            [
                RuleGroupHistory(self.group, 3, base_triggered_date),
                RuleGroupHistory(group_2, 1, base_triggered_date),
            ],
            self.user,
            RuleGroupHistorySerializer(),
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=before_now(days=6),
            end=before_now(days=0),
            per_page=1,
        )
        assert resp.data == serialize(
            [RuleGroupHistory(self.group, 3, base_triggered_date)],
            self.user,
            RuleGroupHistorySerializer(),
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=before_now(days=6),
            end=before_now(days=0),
            per_page=1,
            cursor=self.get_cursor_headers(resp)[1],
        )
        assert resp.data == serialize(
            [RuleGroupHistory(group_2, 1, base_triggered_date)],
            self.user,
            RuleGroupHistorySerializer(),
        )

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

    def test_invalid_dates(self) -> None:
        rule = self.create_project_rule()

        self.login_as(self.user)
        resp = self.get_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=before_now(days=0),
            end=before_now(days=6),
        )
        assert resp.status_code == 400
