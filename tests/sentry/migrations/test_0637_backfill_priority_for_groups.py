import logging
from typing import Tuple

from sentry.issues.grouptype import (
    ErrorGroupType,
    FeedbackGroup,
    MonitorCheckInFailure,
    PerformanceConsecutiveHTTPQueriesGroupType,
    PerformanceP95EndpointRegressionGroupType,
    ReplayDeadClickType,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus, PriorityLevel


class BackfillGroupPriority(TestMigrations):
    migrate_from = "0636_monitor_incident_env_resolving_index"
    migrate_to = "0637_backfill_priority_for_groups"

    def _create_groups_to_backfill(
        self, project: Project
    ) -> Tuple[list[Group], list[Group], list[Group]]:
        data = [
            # groups with priority remain unchanged, even if escalating.
            (
                "existing high priority",
                {"priority": PriorityLevel.HIGH},
                PriorityLevel.HIGH,
            ),
            (
                "existing low priority",
                {
                    "priority": PriorityLevel.LOW,
                    "status": GroupStatus.UNRESOLVED,
                    "substatus": GroupSubStatus.ESCALATING,
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

        low_priority_groups = []
        medium_priority_groups = []
        high_priority_groups = []

        for desc, group_data, expected_priority in data:
            group = self.create_group(project=project, **group_data)
            if expected_priority == PriorityLevel.LOW:
                low_priority_groups.append((desc, group))

            elif expected_priority == PriorityLevel.MEDIUM:
                medium_priority_groups.append((desc, group))

            elif expected_priority == PriorityLevel.HIGH:
                high_priority_groups.append((desc, group))

        return low_priority_groups, medium_priority_groups, high_priority_groups

    def setup_initial_state(self):
        (
            self.low_priority_groups,
            self.medium_priority_groups,
            self.high_priority_groups,
        ) = self._create_groups_to_backfill(self.project)

    def test(self):
        for desc, group in self.high_priority_groups:
            group.refresh_from_db()
            assert group.priority == PriorityLevel.HIGH, desc
            # assert group.data["metadata"]["initial_priority"] == PriorityLevel.HIGH

        for desc, group in self.medium_priority_groups:
            group.refresh_from_db()
            assert group.priority == PriorityLevel.MEDIUM, desc
            # assert group.data["metadata"]["initial_priority"] == PriorityLevel.MEDIUM

        for desc, group in self.low_priority_groups:
            group.refresh_from_db()
            assert group.priority == PriorityLevel.LOW, desc
            # assert group.data["metadata"]["initial_priority"] == PriorityLevel.LOW
