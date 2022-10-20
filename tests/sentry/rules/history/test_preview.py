from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Activity, Group
from sentry.rules.history.preview import PREVIEW_TIME_RANGE, preview
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


def get_hours(time: timedelta) -> int:
    return time.days * 24 + time.seconds // (60 * 60)


@freeze_time()
@region_silo_test
class ProjectRulePreviewTest(TestCase):
    def _set_up_first_seen(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        for i in range(hours):
            for j in range(i % 5):
                Group.objects.create(
                    project=self.project, first_seen=timezone.now() - timedelta(hours=i + 1)
                )

    def _set_up_activity(self, condition_type):
        hours = get_hours(PREVIEW_TIME_RANGE)
        for i in range(hours):
            group = Group.objects.create(id=i, project=self.project)
            Activity.objects.create(
                project=self.project,
                group=group,
                type=condition_type.value,
                datetime=timezone.now() - timedelta(hours=i + 1),
            )

    def _test_preview(self, condition, result1, result2):
        conditions = [{"id": condition}]
        result = preview(self.project, conditions, [], "all", "all", 0)
        assert len(result) == result1

        result = preview(self.project, conditions, [], "all", "all", 120)
        assert len(result) == result2

    def test_first_seen(self):
        self._set_up_first_seen()
        self._test_preview(
            "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition", 670, 134
        )

    def test_regression(self):
        self._set_up_activity(ActivityType.SET_REGRESSION)
        self._test_preview(
            "sentry.rules.conditions.regression_event.RegressionEventCondition",
            336,
            168,
        )

    def test_reappeared(self):
        self._set_up_activity(ActivityType.SET_UNRESOLVED)
        self._test_preview(
            "sentry.rules.conditions.reappeared_event.ReappearedEventCondition", 336, 168
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
        assert len(result) == 0
