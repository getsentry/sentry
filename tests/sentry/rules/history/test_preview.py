from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Activity, Group
from sentry.rules.history.preview import PREVIEW_TIME_RANGE, get_hourly_bucket, preview
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@freeze_time()
@region_silo_test
class ProjectRulePreviewTest(TestCase):
    def _set_up_first_seen(self):
        hours = get_hourly_bucket(PREVIEW_TIME_RANGE)
        for i in range(hours):
            for j in range(i % 5):
                Group.objects.create(
                    project=self.project, first_seen=timezone.now() - timedelta(hours=i + 1)
                )
        return hours

    def _set_up_activity(self, condition_type):
        hours = get_hourly_bucket(PREVIEW_TIME_RANGE)
        for i in range(hours):
            for j in range(i % 5):
                Activity.objects.create(
                    project=self.project,
                    group=self.group,
                    type=condition_type.value,
                    datetime=timezone.now() - timedelta(hours=i + 1),
                )
        return hours

    def _test_preview(self, hours, condition):
        conditions = [{"id": condition}]
        # test with 0 frequency, no fires should be filtered
        result = preview(self.project, conditions, [], "all", "all", 0)
        for i in range(hours):
            assert result[hours - i - 1].count == i % 5

        # test with 60min frequency, there should be at most 1 fire per 60min bucket
        result = preview(self.project, conditions, [], "all", "all", 60)
        for i in range(hours):
            assert result[i].count == (1 if i % 5 else 0)

    def test_first_seen(self):
        hours = self._set_up_first_seen()
        self._test_preview(
            hours, "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
        )

    def test_regression(self):
        hours = self._set_up_activity(ActivityType.SET_REGRESSION)
        self._test_preview(
            hours, "sentry.rules.conditions.regression_event.RegressionEventCondition"
        )

    def test_reappeared(self):
        hours = self._set_up_activity(ActivityType.SET_UNRESOLVED)
        self._test_preview(
            hours, "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"
        )

    def test_unsupported_conditions(self):
        self._set_up_first_seen()
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
