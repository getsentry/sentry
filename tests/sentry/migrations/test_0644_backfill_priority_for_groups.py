import logging

from django.conf import settings

from sentry.issues.grouptype import (
    ErrorGroupType,
    FeedbackGroup,
    MonitorCheckInFailure,
    PerformanceConsecutiveHTTPQueriesGroupType,
    PerformanceP95EndpointRegressionGroupType,
    ReplayDeadClickType,
)
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus
from sentry.utils import redis


class PriorityLevel:
    LOW = 25
    MEDIUM = 50
    HIGH = 75


class BackfillGroupPriority(TestMigrations):
    migrate_from = "0643_add_date_modified_col_dashboard_widget_query"
    migrate_to = "0644_backfill_priority_for_groups"

    def setup_initial_state(self):
        self._create_groups_to_backfill(self.project)
        redis_cluster = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
        redis_cluster.set("priority_backfill.last_processed_id", self.cache_group_id)

    def test(self):
        for groups, expected_priority in (
            (self.high_priority_groups, PriorityLevel.HIGH),
            (self.medium_priority_groups, PriorityLevel.MEDIUM),
            (self.low_priority_groups, PriorityLevel.LOW),
        ):
            for desc, group in groups:
                group.refresh_from_db()
                if desc == "skip me":
                    # these groups should not have been backfilled because the group id is less than the redis cached ID
                    assert not group.priority
                    continue

                assert group.priority == expected_priority, desc
                if not desc.startswith("existing"):
                    assert group.data.get("metadata")["initial_priority"] == expected_priority

    def _create_groups_to_backfill(self, project: Project) -> None:
        skipped_group_count = 3
        data = [
            # three groups to skip to test the redis cache
            (
                "skip me",
                {"type": FeedbackGroup.type_id},
                PriorityLevel.MEDIUM,
            ),
            (
                "skip me",
                {"type": FeedbackGroup.type_id},
                PriorityLevel.MEDIUM,
            ),
            (
                "skip me",
                {"type": FeedbackGroup.type_id},
                PriorityLevel.MEDIUM,
            ),
            # groups with priority remain unchanged, even if escalating.
            (
                "existing low priority",
                {
                    "priority": PriorityLevel.LOW,
                    "data": {"metadata": {"initial_priority": PriorityLevel.LOW}},
                },
                PriorityLevel.LOW,
            ),
            (
                "existing low priority with escalation",
                {
                    "priority": PriorityLevel.LOW,
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "data": {"metadata": {"initial_priority": PriorityLevel.LOW}},
                },
                PriorityLevel.LOW,
            ),
            # escalating groups are high priority, except for Replay and Feedback issues
            (
                "escalating error group",
                {
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "type": ErrorGroupType.type_id,
                    "level": logging.INFO,  # this level should not matter
                },
                PriorityLevel.HIGH,
            ),
            (
                "escalating performance group",
                {
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "type": PerformanceConsecutiveHTTPQueriesGroupType.type_id,
                },
                PriorityLevel.HIGH,
            ),
            (
                "escalating cron group",
                {
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "type": MonitorCheckInFailure.type_id,
                },
                PriorityLevel.HIGH,
            ),
            (
                "escalating replay group",
                {
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "type": ReplayDeadClickType.type_id,
                },
                PriorityLevel.MEDIUM,
            ),
            (
                "escalating feedback group",
                {
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
                    "type": FeedbackGroup.type_id,
                },
                PriorityLevel.MEDIUM,
            ),
            # error groups respect log levels if present
            (
                "error group with log level INFO",
                {
                    "type": ErrorGroupType.type_id,
                    "level": logging.INFO,
                },
                PriorityLevel.LOW,
            ),
            (
                "error group with log level DEBUG",
                {
                    "type": ErrorGroupType.type_id,
                    "level": logging.DEBUG,
                },
                PriorityLevel.LOW,
            ),
            (
                "error group with log level WARNING",
                {
                    "type": ErrorGroupType.type_id,
                    "level": logging.WARNING,
                },
                PriorityLevel.MEDIUM,
            ),
            (
                "error group with log level ERROR",
                {
                    "type": ErrorGroupType.type_id,
                    "level": logging.ERROR,
                },
                PriorityLevel.HIGH,
            ),
            (
                "error group with log level FATAL",
                {
                    "type": ErrorGroupType.type_id,
                    "level": logging.FATAL,
                },
                PriorityLevel.HIGH,
            ),
            # cron groups are medium priority if they are warnings, high priority otherwise
            (
                "cron group with log level WARNING",
                {
                    "type": MonitorCheckInFailure.type_id,
                    "level": logging.WARNING,
                },
                PriorityLevel.MEDIUM,
            ),
            (
                "cron group with log level ERROR",
                {
                    "substatus": GroupSubStatus.ONGOING,
                    "type": MonitorCheckInFailure.type_id,
                    "level": logging.ERROR,
                },
                PriorityLevel.HIGH,
            ),
            (
                "cron group with log level DEBUG",
                {
                    "type": MonitorCheckInFailure.type_id,
                    "level": logging.DEBUG,
                },
                PriorityLevel.HIGH,
            ),
            # statistical detectors are medium priority
            (
                "statistical detector group",
                {
                    "level": logging.ERROR,
                    "type": PerformanceP95EndpointRegressionGroupType.type_id,
                },
                PriorityLevel.MEDIUM,
            ),
            # performance issues are otherwise low priority
            (
                "performance group",
                {
                    "level": logging.ERROR,
                    "type": PerformanceConsecutiveHTTPQueriesGroupType.type_id,
                },
                PriorityLevel.LOW,
            ),
        ]

        self.low_priority_groups = []
        self.medium_priority_groups = []
        self.high_priority_groups = []

        for desc, group_data, expected_priority in data:
            group = self.create_group(project, **group_data)  # type: ignore[arg-type]

            if desc == "skip me":
                skipped_group_count -= 1
                if skipped_group_count == 0:
                    self.cache_group_id = group.id

            if expected_priority == PriorityLevel.LOW:
                self.low_priority_groups.append((desc, group))

            elif expected_priority == PriorityLevel.MEDIUM:
                self.medium_priority_groups.append((desc, group))

            elif expected_priority == PriorityLevel.HIGH:
                self.high_priority_groups.append((desc, group))
