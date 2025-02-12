# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections.abc import Callable
from typing import Any, TypedDict

from pydantic.fields import Field

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc import OptionValue, RpcModel


def _project_status_visible() -> int:
    return int(ObjectStatus.ACTIVE)


class ProjectFilterArgs(TypedDict, total=False):
    project_ids: list[int]


class RpcProjectFlags(RpcModel):
    has_releases: bool
    has_issue_alerts_targeting: bool
    has_transactions: bool
    has_alert_filters: bool
    has_sessions: bool
    has_profiles: bool
    has_replays: bool
    has_feedbacks: bool
    has_new_feedbacks: bool
    spike_protection_error_currently_active: bool
    spike_protection_transaction_currently_active: bool
    spike_protection_attachment_currently_active: bool
    has_minified_stack_trace: bool
    has_cron_monitors: bool
    has_cron_checkins: bool
    has_sourcemaps: bool
    has_custom_metrics: bool
    has_high_priority_alerts: bool
    has_insights_http: bool
    has_insights_db: bool
    has_insights_assets: bool
    has_insights_app_start: bool
    has_insights_screen_load: bool
    has_insights_vitals: bool
    has_insights_caches: bool
    has_insights_queues: bool
    has_insights_llm_monitoring: bool
    has_flags: bool


class RpcProject(RpcModel):
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = Field(default_factory=_project_status_visible)
    platform: str | None = None
    external_id: str | None = None

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


class RpcProjectOptionValue(RpcModel):
    keyed_result: OptionValue
    well_known_result: OptionValue
