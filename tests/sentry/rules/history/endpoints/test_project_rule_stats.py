from datetime import datetime, timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.models import Rule, RuleFireHistory
from sentry.rules.history.base import TimeSeriesValue
from sentry.rules.history.endpoints.project_rule_stats import TimeSeriesValueSerializer
from sentry.testutils import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import control_silo_test, region_silo_test


@control_silo_test(stable=True)
class TimeSeriesValueSerializerTest(TestCase):
    def test(self):
        time_series_value = TimeSeriesValue(datetime.now(), 30)
        result = serialize([time_series_value], self.user, TimeSeriesValueSerializer())
        assert result == [
            {
                "date": time_series_value.bucket,
                "count": time_series_value.count,
            }
        ]


@freeze_time()
@region_silo_test
class ProjectRuleStatsIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-stats-index"

    def test(self):
        rule = Rule.objects.create(project=self.event.project)
        rule_2 = Rule.objects.create(project=self.event.project)
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
            start=iso_format(before_now(days=6)),
            end=iso_format(before_now(days=0)),
        )
        assert len(resp.data) == 144
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        assert [r for r in resp.data[-4:]] == [
            {"date": now - timedelta(hours=3), "count": 3},
            {"date": now - timedelta(hours=2), "count": 2},
            {"date": now - timedelta(hours=1), "count": 1},
            {"date": now, "count": 0},
        ]
