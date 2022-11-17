from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Activity, Group, Project
from sentry.rules.history.preview import PREVIEW_TIME_RANGE, get_events, preview
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.types.issues import GroupType


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

    def _set_up_event(self, data):
        event = self.store_event(
            project_id=self.project.id,
            data={
                "timestamp": iso_format(timezone.now() - timedelta(hours=1)),
                **data,
            },
        )
        event.group.update(first_seen=timezone.now() - timedelta(hours=1))
        return event

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

    def test_age_comparison(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        conditions = [{"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}]
        threshold = 24
        filters = [
            {
                "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
                "comparison_type": "newer",
                "time": "hour",
                "value": threshold,
            }
        ]
        first_seen = timezone.now() - PREVIEW_TIME_RANGE
        newer = []
        older = []
        for i in range(hours):
            group = Group.objects.create(project=self.project, first_seen=first_seen)
            Activity.objects.create(
                project=self.project,
                group=group,
                type=ActivityType.SET_REGRESSION.value,
                datetime=first_seen + timedelta(hours=i),
            )
            # this filter is strictly older/newer
            if i < threshold:
                newer.append(group)
            else:
                older.append(group)

        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert all(g in result for g in newer)
        assert all(g not in result for g in older)

    def test_occurrences(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        groups = []
        for i in range(hours):
            groups.append(
                Group.objects.create(
                    project=self.project,
                    first_seen=timezone.now() - timedelta(hours=i + 1),
                    times_seen=i,
                )
            )
        # regression events to trigger conditions
        for group in groups:
            Activity.objects.create(
                project=self.project,
                group=group,
                type=ActivityType.SET_REGRESSION.value,
                datetime=timezone.now() - timedelta(hours=1),
            )
        conditions = [{"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}]
        threshold = 24
        filters = [
            {
                "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
                "value": threshold,  # issue has occurred at least 24 times
            }
        ]

        result = preview(self.project, conditions, filters, "all", "all", 0)
        for i in range(threshold + 1):
            assert groups[i] not in result
        for i in range(threshold + 1, hours):
            assert groups[i] in result

    def test_issue_category(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        prev_hour = timezone.now() - timedelta(hours=1)
        errors = []
        n_plus_one = []
        for i in range(hours):
            if i % 2:
                errors.append(
                    Group.objects.create(
                        project=self.project, first_seen=prev_hour, type=GroupType.ERROR.value
                    )
                )
            else:
                n_plus_one.append(
                    Group.objects.create(
                        project=self.project,
                        first_seen=prev_hour,
                        type=GroupType.PERFORMANCE_N_PLUS_ONE.value,
                    )
                )

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                "value": GroupType.ERROR.value,
            }
        ]
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert all(group in result for group in errors)
        assert all(group not in result for group in n_plus_one)

    def test_level(self):
        event = self._set_up_event({"tags": {"level": "error"}})

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [{"id": "sentry.rules.filters.level.LevelFilter", "level": "40", "match": "eq"}]
        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group in results

        filters[0]["match"] = "gte"
        filters[0]["level"] = "50"
        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group not in results

        filters[0]["match"] = "lte"
        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group in results

    def test_tagged(self):
        event = self._set_up_event({"tags": {"foo": "bar"}})
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group in results

        filters[0]["value"] = "baz"
        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group not in results

    def test_event_attribute(self):
        event = self._set_up_event({"message": "hello world"})
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
                "attribute": "message",
                "match": "eq",
                "value": "hello world",
            }
        ]

        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group in results

        filters[0]["value"] = "goodbye world"
        results = preview(self.project, conditions, filters, "all", "all", 0)
        assert event.group not in results

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


@freeze_time()
@region_silo_test
class GetEventsTest(TestCase):
    def test_get_first_seen(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        two_hours = timezone.now() - timedelta(hours=2)
        self.store_event(project_id=self.project.id, data={"timestamp": iso_format(prev_hour)})
        event = self.store_event(
            project_id=self.project.id, data={"timestamp": iso_format(two_hours)}
        )
        event.group.update(first_seen=two_hours)

        activity = {
            event.group.id: [
                ConditionActivity(
                    group_id=event.group.id,
                    type=ConditionActivityType.CREATE_ISSUE,
                    timestamp=prev_hour,
                )
            ]
        }
        events = get_events(self.project, activity, [])

        assert len(events) == 1
        assert event.event_id in events
        assert activity[event.group.id][0].data["event_id"] == event.event_id

    def test_get_activity(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = Group.objects.create(project=self.project)
        regression_event = self.store_event(
            project_id=self.project.id, data={"timestamp": iso_format(prev_hour)}
        )
        reappeared_event = self.store_event(
            project_id=self.project.id, data={"timestamp": iso_format(prev_hour)}
        )

        activity = {
            group.id: [
                ConditionActivity(
                    group_id=group.id,
                    type=ConditionActivityType.REGRESSION,
                    timestamp=prev_hour,
                    data={"event_id": regression_event.event_id},
                ),
                ConditionActivity(
                    group_id=group.id,
                    type=ConditionActivityType.REAPPEARED,
                    timestamp=prev_hour,
                    data={"event_id": reappeared_event.event_id},
                ),
            ]
        }
        events = get_events(self.project, activity, [])

        assert len(events) == 2
        assert all([event.event_id in events for event in (regression_event, reappeared_event)])
