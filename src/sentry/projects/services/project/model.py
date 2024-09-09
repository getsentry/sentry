# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections.abc import Callable
from typing import Any

from pydantic.fields import Field
from typing_extensions import TypedDict

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc import OptionValue, RpcModel


def _project_status_visible() -> int:
    return int(ObjectStatus.ACTIVE)


class ProjectFilterArgs(TypedDict, total=False):
    project_ids: list[int]


class RpcProjectFlags(RpcModel):
    # This Project has sent release data
    has_releases: bool

    # This Project has issue alerts targeting
    has_issue_alerts_targeting: bool

    # This Project has sent transactions
    has_transactions: bool

    # This Project has filters
    has_alert_filters: bool

    # This Project has sessions
    has_sessions: bool

    # This Project has sent profiles
    has_profiles: bool

    # This Project has sent replays
    has_replays: bool

    # This project has sent feedbacks
    has_feedbacks: bool

    # This project has sent new feedbacks, from the user-initiated widget
    has_new_feedbacks: bool

    # spike protection flags are DEPRECATED
    spike_protection_error_currently_active: bool
    spike_protection_transaction_currently_active: bool
    spike_protection_attachment_currently_active: bool

    # This Project has event with minified stack trace
    has_minified_stack_trace: bool

    # This Project has cron monitors
    has_cron_monitors: bool

    # This Project has sent check-ins
    has_cron_checkins: bool

    # This Project has event with sourcemaps
    has_sourcemaps: bool

    # This Project has custom metrics
    has_custom_metrics: bool

    # This Project has enough issue volume to use high priority alerts
    has_high_priority_alerts: bool

    # This Project has sent insight request spans
    has_insights_http: bool

    # This Project has sent insight db spans
    has_insights_db: bool

    # This Project has sent insight assets spans
    has_insights_assets: bool

    # This Project has sent insight app starts spans
    has_insights_app_start: bool

    # This Project has sent insight screen load spans
    has_insights_screen_load: bool

    # This Project has sent insight vitals spans
    has_insights_vitals: bool

    # This Project has sent insight caches spans
    has_insights_caches: bool

    # This Project has sent insight queues spans
    has_insights_queues: bool

    # This Project has sent insight llm monitoring spans
    has_insights_llm_monitoring: bool


class RpcProject(RpcModel):
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = Field(default_factory=_project_status_visible)
    platform: str | None = None

    def get_option(
        self,
        key: str,
        default: Any | None = None,
        validate: Callable[[object], bool] | None = None,
    ) -> Any:
        from sentry.projects.services.project import project_service

        keyed_result, well_known_result = project_service.get_option(project=self, key=key)
        if validate is None or validate(keyed_result):
            return keyed_result
        if default is not None:
            return default
        return well_known_result

    def update_option(self, key: str, value: Any) -> bool:
        from sentry.projects.services.project import project_service

        return project_service.update_option(self, key, value)

    def delete_option(self, key: str) -> None:
        from sentry.projects.services.project import project_service

        project_service.delete_option(self, key)

    def get_flags(self) -> RpcProjectFlags:
        from sentry.projects.services.project import project_service

        return project_service.get_flags()


class RpcProjectOptionValue(RpcModel):
    keyed_result: OptionValue
    well_known_result: OptionValue
