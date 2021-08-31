from __future__ import annotations

from typing import Any, Iterable, Mapping, MutableMapping

from sentry.db.models import Model
from sentry.models import Organization, Project, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.types import NotificationSettingTypes
from sentry.tasks.reports import Report
from sentry.tasks.reports.types.duration import DURATIONS
from sentry.tasks.reports.utils.notification import (
    date_format,
    fetch_personal_statistics,
    to_context,
)
from sentry.tasks.reports.utils.util import _to_interval


class WeeklyReportNotification(BaseNotification):
    metrics_key = "weekly-reports"
    template_path = "sentry/emails/reports/body"
    notification_setting_type = NotificationSettingTypes.REPORTS

    def __init__(
        self,
        timestamp: float,
        duration: float,
        organization: Organization,
        user: User,
        reports: Mapping[Project, Report],
    ):
        super().__init__(organization)
        self.start, self.stop = self.interval = _to_interval(timestamp, duration)
        self.duration_spec = DURATIONS[duration]
        self.user = user
        self.reports = reports

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "{} Report for {}: {} - {}".format(
            self.duration_spec.adjective.title(),
            self.organization.name,
            date_format(self.start),
            date_format(self.stop),
        )

    @property
    def reference(self) -> Model | None:
        return self.organization

    def get_notification_title(self) -> str:
        return "Your weekly report is ready"

    def get_title_link(self, recipient: Team | User) -> str | None:
        return None

    def determine_recipients(self) -> Iterable[Team | User]:
        return [self.user]

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "duration": self.duration_spec,
            "interval": {"start": date_format(self.start), "stop": date_format(self.stop)},
            "organization": self.organization,
            "personal": fetch_personal_statistics(self.interval, self.organization, self.user),
            "report": to_context(self.organization, self.interval, self.reports),
            "user": self.user,
        }

    def get_message_description(self, recipient: Team | User) -> Any:
        return self.get_context()["text_description"]
