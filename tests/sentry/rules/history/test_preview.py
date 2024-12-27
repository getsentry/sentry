from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.grouping.types import ErrorGroupType
from sentry.issues.grouptype import (
    GroupCategory,
    PerformanceNPlusOneGroupType,
    ProfileFileIOGroupType,
)
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules.history.preview import (
    FREQUENCY_CONDITION_GROUP_LIMIT,
    PREVIEW_TIME_RANGE,
    GroupActivityMap,
    get_events,
    get_top_groups,
    preview,
)
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

MATCH_ARGS = ("all", "all", 0)


def get_hours(time: timedelta) -> int:
    return time.days * 24 + time.seconds // (60 * 60)


@freeze_time()
class ProjectRulePreviewTest(TestCase, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        self.transaction_data = load_data(
            "transaction",
            fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group1"],
        )

    def _set_up_first_seen(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        for i in range(hours):
            Group.objects.create(
                project=self.project, first_seen=timezone.now() - timedelta(hours=i + 1)
            )
        return hours

    def _set_up_activity(self, condition_type, data=None):
        hours = get_hours(PREVIEW_TIME_RANGE)
        for i in range(hours):
            group = Group.objects.create(id=i, project=self.project)
            Activity.objects.create(
                project=self.project,
                group=group,
                type=condition_type.value,
                datetime=timezone.now() - timedelta(hours=i + 1),
                data=data or {},
            )
        return hours

    def _set_up_event(self, data):
        event = self.store_event(
            project_id=self.project.id,
            data={
                "timestamp": (timezone.now() - timedelta(hours=1)).isoformat(),
                **data,
            },
        )
        event.group.update(first_seen=timezone.now() - timedelta(hours=1))
        return event

    def _test_preview(self, condition, expected):
        conditions = [{"id": condition}]
        result = preview(self.project, conditions, [], "all", "all", 60)
        assert result is not None
        assert len(result) == expected

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

        result = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert result is not None
        assert all(g.id in result for g in newer)
        assert all(g.id not in result for g in older)

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

        result = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert result is not None
        for i in range(threshold + 1):
            assert groups[i].id not in result
        for i in range(threshold + 1, hours):
            assert groups[i].id in result

    def test_issue_category(self):
        hours = get_hours(PREVIEW_TIME_RANGE)
        prev_hour = timezone.now() - timedelta(hours=1)
        errors = []
        n_plus_one = []
        for i in range(hours):
            if i % 2:
                errors.append(
                    Group.objects.create(
                        project=self.project, first_seen=prev_hour, type=ErrorGroupType.type_id
                    )
                )
            else:
                n_plus_one.append(
                    Group.objects.create(
                        project=self.project,
                        first_seen=prev_hour,
                        type=PerformanceNPlusOneGroupType.type_id,
                    )
                )

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                "value": GroupCategory.ERROR.value,
            }
        ]
        result = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert result is not None
        assert all(group.id in result for group in errors)
        assert all(group.id not in result for group in n_plus_one)

    def test_issue_platform(self):
        """Ensure that issues using the issue platform can be shown as a preview."""
        hours = get_hours(PREVIEW_TIME_RANGE)
        prev_hour = timezone.now() - timedelta(hours=1)
        errors = []
        profile_file_io_main_thread = []
        for i in range(hours):
            if i % 2:
                errors.append(
                    Group.objects.create(
                        project=self.project, first_seen=prev_hour, type=ErrorGroupType.type_id
                    )
                )
            else:
                profile_file_io_main_thread.append(
                    Group.objects.create(
                        project=self.project,
                        first_seen=prev_hour,
                        type=ProfileFileIOGroupType.type_id,
                    )
                )

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                "value": GroupCategory.PERFORMANCE.value,
            }
        ]
        result = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert result is not None
        assert all(group.id not in result for group in errors)
        assert all(group.id in result for group in profile_file_io_main_thread)

    def test_level(self):
        event = self._set_up_event({"tags": {"level": "error"}})

        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [{"id": "sentry.rules.filters.level.LevelFilter", "level": "40", "match": "eq"}]
        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id in results

        filters[0]["match"] = "gte"
        filters[0]["level"] = "50"
        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id not in results

        filters[0]["match"] = "lte"
        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id in results

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

        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id in results

        filters[0]["value"] = "baz"
        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id not in results

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

        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id in results

        filters[0]["value"] = "goodbye world"
        results = preview(self.project, conditions, filters, *MATCH_ARGS)
        assert results is not None
        assert event.group.id not in results

    def test_unsupported_conditions(self):
        self._set_up_first_seen()
        self._set_up_event({})
        # conditions with no immediate plan to support
        unsupported_conditions = [
            "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
        ]
        for condition in unsupported_conditions:
            result = preview(self.project, [{"id": condition}], [], *MATCH_ARGS)
            assert result is None

        unsupported_filters = [
            "sentry.rules.filters.assigned_to.AssignedToFilter",
            "sentry.rules.filters.latest_release.LatestReleaseFilter",
        ]
        for filter in unsupported_filters:
            result = preview(
                self.project,
                [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
                [{"id": filter}],
                *MATCH_ARGS,
            )
            assert result is None

        # empty condition
        assert None is preview(self.project, [], [], "all", "all", 60)
        # same as empty condition
        assert None is preview(
            self.project,
            [{"id": "sentry.rules.conditions.every_event.EveryEventCondition"}],
            [],
            *MATCH_ARGS,
        )

    def test_mutually_exclusive_conditions(self):
        mutually_exclusive = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]

        result = preview(self.project, mutually_exclusive, [], "all", "all", 60)
        assert result is not None
        assert len(result) == 0

    def test_conditions_with_priority(self):
        invalid_conditions = [
            [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {
                    "id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
                },
            ],
            [
                {"id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"},
                {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
            ],
            [
                {"id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"},
                {
                    "id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
                },
            ],
        ]

        for condition in invalid_conditions:
            result = preview(self.project, condition, [], "all", "all", 60)
            assert result is not None
            assert len(result) == 0

        hours = self._set_up_first_seen()
        new_high_priority = [
            {"id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"},
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
        ]

        result = preview(self.project, new_high_priority, [], "all", "all", 60)
        assert result is not None
        assert len(result) == hours

        existing_high_priority = [
            {
                "id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
            },
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]

        Group.objects.all().delete()
        hours = self._set_up_activity(
            ActivityType.SET_PRIORITY, data={"priority": "high", "reason": "escalating"}
        )
        result = preview(self.project, existing_high_priority, [], "all", "all", 60)
        assert result is not None
        assert len(result) == hours

    def test_multiple_projects(self):
        other_project = Project.objects.create(organization=self.organization)
        prev_hour = timezone.now() - timedelta(hours=1)
        groups = []
        for i, project in enumerate((self.project, other_project)):
            first_seen = Group.objects.create(project=project, first_seen=prev_hour)
            regression = Group.objects.create(project=project)
            reappearance = Group.objects.create(project=project)
            groups.append((first_seen, regression, reappearance))
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
                user_id=None,
                datetime=prev_hour,
            )

        conditions = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]
        result = preview(self.project, conditions, [], "any", "all", 0)
        assert result is not None
        # result should only contain groups of `self.project`
        assert all(g.id in result for g in groups[0])
        assert all(g.id not in result for g in groups[1])

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
            user_id=None,
            datetime=out_of_range,
        )

        conditions = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
        ]
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result == {}

    def test_transactions(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        transaction = self.create_performance_issue(tags=[["foo", "bar"]])

        perf_issue = transaction.group
        perf_issue.update(first_seen=prev_hour)
        Activity.objects.create(
            project=self.project,
            group=perf_issue,
            type=ActivityType.SET_REGRESSION.value,
            datetime=prev_hour,
            data={"event_id": transaction.event_id},
        )
        conditions = [{"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}]
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert result is not None
        assert perf_issue.id in result

        filters[0]["value"] = "baz"
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert result is not None
        assert perf_issue.id not in result

        filters = [
            {
                "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
                "attribute": "message",
                "match": "co",
                "value": "N+1 Query",
            }
        ]
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert result is not None
        assert perf_issue.id in result

        filters[0]["value"] = "wrong message"
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert result is not None
        assert perf_issue.id not in result
        # this can be tested when SNS-1891 is fixed
        """
        conditions = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        filters = [{
            "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
            "key": "foo",
            "match": "eq",
            "value": "bar",
        }]
        result = preview(self.project, conditions, filters, "all", "all", 0)
        assert result is not None
        assert perf_issue.id in result
        """

    def test_errors_transactions_together(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        error = self.store_event(
            project_id=self.project.id,
            data={"timestamp": prev_hour.isoformat(), "tags": {"foo": "bar"}},
        )
        issue = error.group
        issue.update(first_seen=prev_hour)

        transaction = self.create_performance_issue(tags=[["foo", "bar"]])

        perf_issue = transaction.group
        perf_issue.update(first_seen=timezone.now() - timedelta(weeks=3))
        Activity.objects.create(
            project=self.project,
            group=perf_issue,
            type=ActivityType.SET_REGRESSION.value,
            datetime=prev_hour,
            data={"event_id": transaction.event_id},
        )

        conditions = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
        ]
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]
        result = preview(self.project, conditions, filters, "any", "all", 0)
        assert result is not None
        assert issue.id in result and perf_issue.id in result

    def test_triggered_times(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        prev_two_hour = timezone.now() - timedelta(hours=2)
        for time in (prev_hour, prev_two_hour):
            Activity.objects.create(
                project=self.project,
                group=self.group,
                type=ActivityType.SET_REGRESSION.value,
                datetime=time,
            )

        conditions = [{"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}]

        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert result[self.group.id] == prev_hour

        result = preview(self.project, conditions, [], "all", "all", 180)
        assert result is not None
        assert result[self.group.id] == prev_two_hour


@freeze_time()
class FrequencyConditionTest(
    TestCase, SnubaTestCase, OccurrenceTestMixin, PerformanceIssueTestCase
):
    def setUp(self):
        super().setUp()
        self.transaction_data = load_data(
            "transaction",
            fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group1"],
        )

    def test_top_groups(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group_activity: GroupActivityMap = {}
        dataset_map = {}
        top_groups = set()
        for i in range(FREQUENCY_CONDITION_GROUP_LIMIT):
            for j in range(2):
                event = self.store_event(
                    project_id=self.project.id,
                    data={
                        "fingerprint": ["group-" + str(i)],
                        "timestamp": prev_hour.isoformat(),
                    },
                )
                group_activity[event.group_id] = []
                dataset_map[event.group_id] = Dataset.Events
                top_groups.add(event.group_id)
        event = self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-" + str(FREQUENCY_CONDITION_GROUP_LIMIT)],
                "timestamp": prev_hour.isoformat(),
            },
        )
        group_activity[event.group_id] = []
        dataset_map[event.group_id] = Dataset.Events

        activity = get_top_groups(
            self.project,
            timezone.now() - timedelta(hours=2),
            timezone.now(),
            group_activity,
            dataset_map,
        )
        assert event.group_id not in activity
        assert all([group in activity for group in top_groups])

        activity = get_top_groups(
            self.project,
            timezone.now() - timedelta(hours=2),
            timezone.now(),
            {},
            dataset_map,
            False,
        )
        assert event.group_id not in activity
        assert all([group in activity for group in top_groups])

    def test_event_frequency_condition(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        prev_two_hour = timezone.now() - timedelta(hours=2)
        for time in (prev_hour, prev_two_hour):
            for i in range(5):
                group = self.store_event(
                    project_id=self.project.id, data={"timestamp": time.isoformat()}
                ).group
            Activity.objects.create(
                project=self.project,
                group=group,
                type=ActivityType.SET_REGRESSION.value,
                datetime=time,
            )

        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 4,
                "interval": "5m",
            },
        ]
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[1]["value"] = 5
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result

        conditions[1]["interval"] = "1d"
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

    def test_transaction(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        event_data = load_data("transaction-n-plus-one")

        event_data.update(
            {
                "start_timestamp": (prev_hour - timedelta(minutes=1)).isoformat(),
                "timestamp": prev_hour.isoformat(),
                "tags": {"foo": "bar"},
            }
        )
        transaction = self.create_performance_issue(event_data=event_data)
        group = transaction.group

        Activity.objects.create(
            project=self.project,
            group=group,
            type=ActivityType.SET_REGRESSION.value,
            datetime=prev_hour,
            data={"event_id": transaction.event_id},
        )

        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 0,
                "interval": "5m",
            },
        ]

        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[1]["value"] = 1
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result

    def test_no_activity_event_filter(self):
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 0,
                "interval": "5m",
            },
        ]

        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result == {}

    def test_frequency_condition_alone(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = None
        for i in range(5):
            group = self.store_event(
                project_id=self.project.id, data={"timestamp": prev_hour.isoformat()}
            ).group
        assert group is not None
        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 4,
                "interval": "5m",
            }
        ]
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[0]["value"] = 5
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result

    def test_frequency_conditions(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        prev_two_hour = timezone.now() - timedelta(hours=2)
        for time in (prev_hour, prev_two_hour):
            for i in range(5):
                event = self.store_event(
                    project_id=self.project.id, data={"timestamp": time.isoformat()}
                )
                event = event.for_group(event.groups[0])
                occurrence = self.build_occurrence(level="info")
                occurrence.save()
                event.occurrence = occurrence
                event.group.type = ProfileFileIOGroupType.type_id

        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 4,
                "interval": "5m",
            },
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 9,
                "interval": "1d",
            },
        ]
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert event.group.id in result

        conditions[0]["value"] = 5
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert event.group.id not in result

        result = preview(self.project, conditions, [], "any", "all", 0)
        assert result is not None
        assert event.group.id in result

    def test_interval_comparison(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = None
        for time, count in ((prev_hour, 2), (prev_hour - timedelta(minutes=5), 1)):
            for i in range(count):
                group = self.store_event(
                    project_id=self.project.id, data={"timestamp": time.isoformat()}
                ).group
        assert group is not None
        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 99,
                "interval": "5m",
                "comparisonType": "percent",
                "comparisonInterval": "5m",
            },
        ]
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[0]["value"] = 100
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result

        conditions.append(
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 99,
                "interval": "5m",
                "comparisonType": "percent",
                "comparisonInterval": "5m",
            }
        )
        result = preview(self.project, conditions, [], "any", "all", 0)
        assert result is not None
        assert group.id in result

    def test_unique_user(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = None
        for user in range(3):
            for i in range(2):
                group = self.store_event(
                    project_id=self.project.id,
                    data={"timestamp": prev_hour.isoformat(), "user": {"id": str(user)}},
                ).group
        assert group is not None
        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
                "value": 2,
                "interval": "5m",
            }
        ]

        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[0]["value"] = 3
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result

    def tests_multiple_freq_cond_types(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = self.store_event(
            project_id=self.project.id,
            data={"timestamp": prev_hour.isoformat(), "user": {"id": self.user.id}},
        ).group

        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "value": 0,
                "interval": "5m",
            },
            {
                "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
                "value": 0,
                "interval": "5m",
            },
        ]

        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id in result

        conditions[1]["value"] = 1
        result = preview(self.project, conditions, [], *MATCH_ARGS)
        assert result is not None
        assert group.id not in result


@freeze_time()
class GetEventsTest(TestCase, SnubaTestCase):
    def test_get_first_seen(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        two_hours = timezone.now() - timedelta(hours=2)
        self.store_event(project_id=self.project.id, data={"timestamp": prev_hour.isoformat()})
        event = self.store_event(
            project_id=self.project.id, data={"timestamp": two_hours.isoformat()}
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
        events = get_events(
            self.project,
            activity,
            {Dataset.Events: []},
            timezone.now() - timedelta(weeks=2),
            timezone.now(),
        )

        assert len(events) == 1
        assert event.event_id in events
        assert activity[event.group.id][0].data["event_id"] == event.event_id

    def test_get_activity(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group = Group.objects.create(project=self.project)
        regression_event = self.store_event(
            project_id=self.project.id, data={"timestamp": prev_hour.isoformat()}
        )
        reappeared_event = self.store_event(
            project_id=self.project.id, data={"timestamp": prev_hour.isoformat()}
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
        events = get_events(
            self.project,
            activity,
            {Dataset.Events: []},
            timezone.now() - timedelta(weeks=2),
            timezone.now(),
        )

        assert len(events) == 2
        assert all([event.event_id in events for event in (regression_event, reappeared_event)])
