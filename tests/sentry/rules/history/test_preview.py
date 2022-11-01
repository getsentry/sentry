from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Activity, Group, Project
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
            Group.objects.create(
                project=self.project, first_seen=timezone.now() - timedelta(hours=i + 1)
            )
        return hours

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
        return hours

    def _test_preview(self, condition, expected):
        conditions = [{"id": condition}]
        result = preview(self.project, conditions, [], "all", "all", 60)
        assert result.count() == expected

    def test_first_seen(self):
        hours = self._set_up_first_seen()
        self._test_preview(
            "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            hours,
        )

    def test_regression(self):
        hours = self._set_up_activity(ActivityType.SET_REGRESSION)
        self._test_preview(
            "sentry.rules.conditions.regression_event.RegressionEventCondition",
            hours,
        )

    def test_reappeared(self):
        hours = self._set_up_activity(ActivityType.SET_UNRESOLVED)
        self._test_preview(
            "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
            hours,
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

    def test_multiple_projects(self):
        other_project = Project.objects.create(organization=self.organization)
        prev_hour = timezone.now() - timedelta(hours=1)
        groups = [[], []]
        for i, project in enumerate((self.project, other_project)):
            first_seen = Group.objects.create(project=project, first_seen=prev_hour)
            regression = Group.objects.create(project=project)
            reappearance = Group.objects.create(project=project)
            groups[i] = [first_seen, regression, reappearance]
            Activity.objects.create(
                project=project,
                group=regression,
                type=ActivityType.SET_REGRESSION.value,
                datetime=prev_hour,
            )
            Activity.objects.create(
                project=project,
                group=reappearance,
                type=ActivityType.SET_UNRESOLVED.value,
                user=None,
                datetime=prev_hour,
            )

        conditions = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]
        result = preview(self.project, conditions, [], "any", "all", 0)
        # result should only contain groups of `self.project`
        assert all(g in result for g in groups[0])
        assert all(g not in result for g in groups[1])

    def test_out_of_time_range(self):
        out_of_range = timezone.now() - PREVIEW_TIME_RANGE - timedelta(hours=1)
        Group.objects.create(project=self.project, first_seen=out_of_range)
        Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_REGRESSION.value,
            datetime=out_of_range,
        )
        Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_UNRESOLVED.value,
            user=None,
            datetime=out_of_range,
        )

        conditions = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]
        result = preview(self.project, conditions, [], "all", "all", 0)
        assert result.count() == 0
