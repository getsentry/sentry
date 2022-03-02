from sentry.api.serializers import serialize
from sentry.models import Rule, RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory
from sentry.rules.history.endpoints.project_rule_group_history import RuleGroupHistorySerializer
from sentry.testutils import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class RuleGroupHistorySerializerTest(TestCase):
    def test(self):
        group_history = RuleGroupHistory(self.group, 50)
        result = serialize([group_history], self.user, RuleGroupHistorySerializer())
        assert result == [
            {
                "group": serialize(self.group, self.user),
                "count": group_history.count,
            }
        ]


class ProjectRuleGroupHistoryIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-group-history-index"

    def test(self):
        history = []
        rule = Rule.objects.create(project=self.project)
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
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
        )
        assert resp.data == serialize(
            [RuleGroupHistory(self.group, 3), RuleGroupHistory(group_2, 1)],
            self.user,
            RuleGroupHistorySerializer(),
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
            per_page=1,
        )
        assert resp.data == serialize(
            [RuleGroupHistory(self.group, 3)],
            self.user,
            RuleGroupHistorySerializer(),
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
            per_page=1,
            cursor=self.get_cursor_headers(resp)[1],
        )
        assert resp.data == serialize(
            [RuleGroupHistory(group_2, 1)],
            self.user,
            RuleGroupHistorySerializer(),
        )
