from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Group
from sentry.rules.history.preview import PREVIEW_TIME_RANGE, get_hourly_bucket, preview
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@freeze_time()
@region_silo_test
class ProjectRulePreviewTest(TestCase):
    def set_up(self):
        hours = get_hourly_bucket(PREVIEW_TIME_RANGE)
        for i in range(hours):
            for j in range(i % 5):
                Group.objects.create(
                    project=self.project, first_seen=timezone.now() - timedelta(hours=i + 1)
                )
        return hours

    def test_first_seen(self):
        hours = self.set_up()
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]

        result = preview(self.project, conditions, [], "all", "all", 0)
        for i in range(hours):
            assert result[hours - i - 1].count == i % 5

        result = preview(self.project, conditions, [], "all", "all", 60)
        for i in range(hours):
            assert result[i].count == (1 if i % 5 else 0)

    def test_unsupported_conditions(self):
        self.set_up()
        # conditions with no immediate plan to support
        unsupported_conditions = [
            "sentry.rules.conditions.tagged_event.TaggedEventCondition",
            "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "sentry.rules.conditions.event_attribute.EventAttributeCondition",
            "sentry.rules.conditions.level.LevelCondition",
        ]
        for condition in unsupported_conditions:
            result = preview(self.project, [{"id": condition}], [], "all", "all", 60)
            assert result is None

        # empty condition
        assert None is preview(self.project, [], [], "all", "all", 60)
        # filters
        assert None is preview(
            self.project,
            [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
            [{"id": "anything"}],
            "all",
            "all",
            60,
        )

    def test_mutually_exclusive_conditions(self):
        mutually_exclusive = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.ReappearedEventCondition"},
        ]

        result = preview(self.project, mutually_exclusive, [], "all", "all", 60)
        for bucket in result:
            assert bucket.count == 0
