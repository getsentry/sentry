from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.dates import to_datetime


class OrganizationReportContext:
    def __init__(
        self, timestamp: float, duration: int, organization: Organization, daily: bool = False
    ):
        self.timestamp = timestamp
        self.duration = duration

        self.start = to_datetime(timestamp - duration)
        self.end = to_datetime(timestamp)

        self.organization: Organization = organization
        self.projects: dict[
            int, ProjectContext | DailySummaryProjectContext
        ] = {}  # { project_id: DailySummaryProjectContext }

        self.project_ownership = {}  # { user_id: set<project_id> }
        self.daily = daily
        for project in organization.project_set.all():
            if self.daily:
                self.projects[project.id] = DailySummaryProjectContext(project)
            else:
                self.projects[project.id] = ProjectContext(project)

    def __repr__(self):
        return self.projects.__repr__()


class DailySummaryProjectContext:
    total_today = 0
    fourteen_day_total = 0
    count_days = 0
    fourteen_day_avg = 0
    key_error_issues = []
    key_performance_issues = []

    def __init__(self, project: Project):
        self.project = project
        self.key_error_issues = []
        self.key_performance_issues = []


class ProjectContext:
    accepted_error_count = 0
    dropped_error_count = 0
    accepted_transaction_count = 0
    dropped_transaction_count = 0
    accepted_replay_count = 0
    dropped_replay_count = 0

    new_substatus_count = 0
    ongoing_substatus_count = 0
    escalating_substatus_count = 0
    regression_substatus_count = 0
    total_substatus_count = 0

    def __init__(self, project: Project):
        self.project = project

        # Array of (group_id, group_history, count)
        self.key_errors = []
        # Array of (transaction_name, count_this_week, p95_this_week, count_last_week, p95_last_week)
        self.key_transactions = []
        # Array of (Group, count)
        self.key_performance_issues = []

        self.key_replay_events = []

        # Dictionary of { timestamp: count }
        self.error_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.transaction_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.replay_count_by_day = {}

    def __repr__(self):
        return "\n".join(
            [
                f"{self.key_errors}, ",
                f"Errors: [Accepted {self.accepted_error_count}, Dropped {self.dropped_error_count}]",
                f"Transactions: [Accepted {self.accepted_transaction_count} Dropped {self.dropped_transaction_count}]",
                f"Replays: [Accepted {self.accepted_replay_count} Dropped {self.dropped_replay_count}]",
            ]
        )
