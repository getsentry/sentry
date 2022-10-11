from datetime import datetime

import freezegun
import pytz

from sentry.api.serializers import serialize
from sentry.models import Rule, RuleFireHistory
from sentry.rules.history.base import RuleGroupHistory
from sentry.rules.history.endpoints.project_rule_group_history import RuleGroupHistorySerializer
from sentry.testutils import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RuleGroupHistorySerializerTest(TestCase):
    def test(self):
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


@freezegun.freeze_time()
@region_silo_test
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
        base_triggered_date = before_now(days=1).replace(tzinfo=pytz.UTC)
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
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
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
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
            per_page=1,
            cursor=self.get_cursor_headers(resp)[1],
        )
        assert resp.data == serialize(
            [RuleGroupHistory(group_2, 1, base_triggered_date)],
            self.user,
            RuleGroupHistorySerializer(),
        )

    def test_invalid_dates(self):
        rule = Rule.objects.create(project=self.project)

        self.login_as(self.user)
        resp = self.get_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            start=iso_format(before_now(days=0)),
            end=iso_format(before_now(days=6)),
        )
        assert resp.status_code == 400
