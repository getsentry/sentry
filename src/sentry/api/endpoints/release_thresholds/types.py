from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.models.release_threshold.constants import ThresholdTypeName, TriggerTypeName

if TYPE_CHECKING:
    from sentry.api.serializers.models.environment import EnvironmentSerializerResponse
    from sentry.api.serializers.models.project import ProjectSerializerResponse


class SerializedThreshold(TypedDict, total=False):
    id: Annotated[str, ApiDescription("ID of the threshold")]
    date_added: Annotated[datetime, ApiDescription("When the threshold was created (ISO 8601)")]
    environment: Annotated[
        EnvironmentSerializerResponse | None,
        ApiDescription("Environment the threshold applies to. Null for all environments"),
    ]
    project: Annotated[
        ProjectSerializerResponse, ApiDescription("Project the threshold applies to")
    ]
    release: Annotated[
        str, ApiDescription("Version of the release the threshold was checked against")
    ]
    threshold_type: Annotated[
        ThresholdTypeName,
        ApiDescription(
            "Metric the threshold checks: total_error_count, new_issue_count, unhandled_issue_count, regressed_issue_count, failure_rate, crash_free_session_rate or crash_free_user_rate"
        ),
    ]
    trigger_type: Annotated[
        TriggerTypeName,
        ApiDescription("Whether the threshold fails when the metric goes over or under value"),
    ]
    value: Annotated[int, ApiDescription("Value the metric is compared with")]
    window_in_seconds: Annotated[
        int,
        ApiDescription(
            "Time after the release or deploy during which the threshold is checked, in seconds"
        ),
    ]


class EnrichedThreshold(SerializedThreshold):
    end: Annotated[
        datetime, ApiDescription("End of the window the threshold was checked in (ISO 8601)")
    ]
    is_healthy: Annotated[bool, ApiDescription("Whether the metric stayed within the threshold")]
    key: Annotated[
        str, ApiDescription("Key that groups thresholds of the same project and release")
    ]
    project_slug: Annotated[str, ApiDescription("Slug of the project")]
    project_id: Annotated[int, ApiDescription("ID of the project")]
    start: Annotated[
        datetime,
        ApiDescription(
            "Start of the window the threshold was checked in: the latest deploy, or the release date (ISO 8601)"
        ),
    ]
    metric_value: Annotated[
        int | float | None,
        ApiDescription("Value of the metric in the window. Null when it couldn't be computed"),
    ]
