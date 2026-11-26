from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, TypedDict

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Function, Op, Query
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.endpoints.project_custom_inbound_filters import (
    CustomInboundFilterCondition,
    CustomInboundFilterRequestSerializer,
    ProjectCustomInboundFilterEndpoint,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.response_types import DetailResponse
from sentry.auth.principal import acting_user_id
from sentry.issues.grouptype import GroupCategory
from sentry.models.custominboundfilter import (
    ConditionOperator,
    ConditionType,
    CustomInboundFilter,
    DataType,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.oneshot import run_oneshot
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.glob import glob_match
from sentry.utils.snuba import SnubaError, raw_snql_query

logger = logging.getLogger(__name__)

NAME_MAX_LENGTH = CustomInboundFilter._meta.get_field("name").max_length
MAX_GROUPS = 100
# Seer reads every selected issue and writes several filters, so it gets more time
# than a name suggestion.
SEER_TIMEOUT_SECONDS = 20
# How far back the events reach that decide what the selected issues have in common.
COMMON_FIELD_LOOKBACK = timedelta(days=7)

# The event fields a filter can match besides the error itself, as Snuba names them.
_COMMON_FIELD_COLUMNS = {
    ConditionType.RELEASE: "release",
    ConditionType.ENVIRONMENT: "environment",
    ConditionType.GEO_COUNTRY_CODE: "geo_country_code",
    ConditionType.BROWSER_NAME: "contexts[browser.name]",
}

# What Seer may use to describe the errors of the selected issues.
_SEER_CONDITION_TYPES = frozenset({ConditionType.ERROR_TYPE, ConditionType.ERROR_MESSAGE})
_SEER_OPERATORS = frozenset(
    {
        ConditionOperator.GLOB,
        ConditionOperator.EQUALS,
        ConditionOperator.STARTS_WITH,
        ConditionOperator.CONTAINS,
        ConditionOperator.ENDS_WITH,
    }
)


class SuggestedCustomInboundFilter(TypedDict):
    name: str
    dataType: str
    conditions: list[CustomInboundFilterCondition]


class CustomInboundFilterSuggestionsResponse(TypedDict):
    filters: list[SuggestedCustomInboundFilter]


@dataclass(frozen=True)
class _SelectedError:
    """What a selected issue says about its errors. An issue of plain messages has no type."""

    type: str | None
    message: str | None


def _selected_error(group: Group) -> _SelectedError:
    metadata = group.get_event_metadata()
    error_type = (metadata.get("type") or "").strip() or None
    message = metadata.get("value") if error_type else metadata.get("title")
    return _SelectedError(type=error_type, message=(message or "").strip() or None)


def _error_filter(
    name: str, conditions: list[CustomInboundFilterCondition]
) -> SuggestedCustomInboundFilter:
    return {
        "name": name[:NAME_MAX_LENGTH],
        "dataType": DataType.ERROR.value,
        "conditions": conditions,
    }


def _exact_filters(errors: Sequence[_SelectedError]) -> list[SuggestedCustomInboundFilter]:
    """
    The filters that match the selected issues exactly as they are: one that lists every
    error type, and one that lists the message of every issue without a type. A filter
    value holds one line, so a message of several lines is left out.
    """
    types = sorted({error.type for error in errors if error.type})
    messages = sorted(
        {
            error.message
            for error in errors
            if not error.type and error.message and "\n" not in error.message
        }
    )
    exact = []
    if types:
        exact.append(
            _error_filter(
                ", ".join(types),
                [
                    {
                        "type": ConditionType.ERROR_TYPE.value,
                        "operator": ConditionOperator.EQUALS.value,
                        "value": types,
                    }
                ],
            )
        )
    if messages:
        exact.append(
            _error_filter(
                ", ".join(messages),
                [
                    {
                        "type": ConditionType.ERROR_MESSAGE.value,
                        "operator": ConditionOperator.EQUALS.value,
                        "value": messages,
                    }
                ],
            )
        )
    return exact


def _matches(condition: CustomInboundFilterCondition, error: _SelectedError) -> bool:
    field = error.type if condition["type"] == ConditionType.ERROR_TYPE else error.message
    if field is None:
        return False
    field = field.lower()
    for value in condition["value"]:
        pattern = value.lower()
        match ConditionOperator(condition["operator"]):
            case ConditionOperator.GLOB:
                matched = glob_match(field, pattern)
            case ConditionOperator.EQUALS:
                matched = field == pattern
            case ConditionOperator.STARTS_WITH:
                matched = field.startswith(pattern)
            case ConditionOperator.ENDS_WITH:
                matched = field.endswith(pattern)
            case _:
                matched = pattern in field
        if matched:
            return True
    return False


def _covers_every_error(
    filters: Sequence[SuggestedCustomInboundFilter], errors: Sequence[_SelectedError]
) -> bool:
    return all(
        any(
            all(_matches(condition, error) for condition in suggested["conditions"])
            for suggested in filters
        )
        for error in errors
    )


def _read_seer_filters(result: dict[str, Any]) -> list[SuggestedCustomInboundFilter] | None:
    """
    The filters of a Seer answer, or None when the answer is not a list of named filters
    whose conditions describe the error with a positive text operator.
    """
    answer = result.get("filters")
    if not isinstance(answer, list) or not answer:
        return None

    filters = []
    for item in answer:
        if not isinstance(item, dict):
            return None
        name = item.get("name")
        conditions = item.get("conditions")
        if not isinstance(name, str) or not name.strip():
            return None
        if not isinstance(conditions, list) or not conditions:
            return None
        read: list[CustomInboundFilterCondition] = []
        for condition in conditions:
            if not isinstance(condition, dict):
                return None
            value = condition.get("value")
            if (
                condition.get("type") not in _SEER_CONDITION_TYPES
                or condition.get("operator") not in _SEER_OPERATORS
                or not isinstance(value, list)
                or not value
                or not all(isinstance(entry, str) and entry.strip() for entry in value)
            ):
                return None
            read.append(
                {"type": condition["type"], "operator": condition["operator"], "value": value}
            )
        filters.append(_error_filter(name.strip(), read))
    return filters


def suggest_filters_with_seer(
    errors: Sequence[_SelectedError],
    common_conditions: Sequence[CustomInboundFilterCondition],
    organization: Organization,
    user_id: int | None,
) -> list[SuggestedCustomInboundFilter] | None:
    """
    Ask Seer's `inbound_filter_suggestions` one-shot how to split the selected issues
    into filters and where a wildcard describes them better than a list. Returns None
    when Seer is unavailable, or when its answer misses one of the issues, so the caller
    falls back to the exact filters.
    """
    try:
        result = run_oneshot(
            "inbound_filter_suggestions",
            {
                "issues": [{"type": error.type, "message": error.message} for error in errors],
                "common_conditions": list(common_conditions),
            },
            organization,
            user_id=user_id,
            timeout=SEER_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.exception("custom_inbound_filters.suggestions.failed")
        metrics.incr("custom_inbound_filters.suggestions", tags={"result": "request_error"})
        return None

    filters = _read_seer_filters(result)
    if filters is None or len(filters) > len(errors):
        metrics.incr("custom_inbound_filters.suggestions", tags={"result": "malformed"})
        return None
    if not _covers_every_error(filters, errors):
        metrics.incr("custom_inbound_filters.suggestions", tags={"result": "misses_issue"})
        return None

    metrics.incr("custom_inbound_filters.suggestions", tags={"result": "success"})
    return filters


def _get_common_conditions(
    project: Project, group_ids: Sequence[int]
) -> list[CustomInboundFilterCondition]:
    """
    A condition for every field that holds one value on all recent events of the
    selected issues, while the events of the project hold several. A value that every
    event of the project shares says nothing about the selection, so it is left out.
    Returns nothing when Snuba fails: the suggestion then describes the errors alone.
    """
    is_selected = Function("in", [Column("group_id"), list(group_ids)])
    select = []
    for condition_type, column in _COMMON_FIELD_COLUMNS.items():
        value = Function("ifNull", [Column(column), ""])
        select += [
            Function("uniqIf", [value, is_selected], f"{condition_type}_selected"),
            Function("anyIf", [value, is_selected], f"{condition_type}_value"),
            Function("uniq", [value], f"{condition_type}_project"),
        ]
    now = timezone.now()
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="custom_inbound_filters",
        query=Query(
            match=Entity("events"),
            select=select,
            where=[
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("timestamp"), Op.GTE, now - COMMON_FIELD_LOOKBACK),
                Condition(Column("timestamp"), Op.LT, now),
            ],
        ),
        tenant_ids={"organization_id": project.organization_id},
    )
    try:
        rows = raw_snql_query(
            request, referrer=Referrer.API_PROJECT_CUSTOM_INBOUND_FILTER_SUGGESTIONS.value
        )["data"]
    except SnubaError:
        logger.exception("custom_inbound_filters.suggestions.common_fields_failed")
        return []
    if not rows:
        return []

    row = rows[0]
    return [
        {
            "type": condition_type.value,
            "operator": ConditionOperator.EQUALS.value,
            "value": [row[f"{condition_type}_value"]],
        }
        for condition_type in _COMMON_FIELD_COLUMNS
        if row[f"{condition_type}_selected"] == 1
        and row[f"{condition_type}_value"]
        and row[f"{condition_type}_project"] > 1
    ]


@cell_silo_endpoint
class CustomInboundFilterSuggestionsEndpoint(ProjectCustomInboundFilterEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def _is_savable(
        self, request: Request, project: Project, suggested: SuggestedCustomInboundFilter
    ) -> bool:
        return CustomInboundFilterRequestSerializer(
            data=suggested, context={"project": project, "request": request}
        ).is_valid()

    def get(
        self, request: Request, project: Project
    ) -> Response[CustomInboundFilterSuggestionsResponse] | Response[DetailResponse]:
        """
        Draft the custom inbound filters that drop the errors of the issues named by the
        `group` query parameters. Nothing is saved.

        Without Seer the answer is exact: one filter that lists every error type of the
        issues, plus one that lists the message of every issue without a type. Seer, when
        the organization has not hidden AI features, may replace a list with a wildcard
        pattern or split unrelated issues into several filters. Every filter also carries
        a condition for each of release, environment, country and browser that holds one
        value on all recent events of the issues but not on all events of the project.
        Issues of other projects and issues that are not errors are ignored.
        """
        organization = project.organization
        if not features.has(
            "organizations:inbound-filters-in-product-flows", organization, actor=request.user
        ):
            raise ResourceDoesNotExist
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        try:
            group_ids = {int(group_id) for group_id in request.GET.getlist("group")}
        except ValueError:
            return Response({"detail": "A group must be an issue ID."}, status=400)
        if not 0 < len(group_ids) <= MAX_GROUPS:
            return Response({"detail": f"Select between 1 and {MAX_GROUPS} issues."}, status=400)

        groups = [
            group
            for group in Group.objects.filter(project_id=project.id, id__in=group_ids)
            if group.issue_category == GroupCategory.ERROR
        ]
        errors = [_selected_error(group) for group in groups]
        exact = _exact_filters(errors)
        if not exact:
            return Response(
                {"detail": "None of the issues is an error with a type or a message."},
                status=400,
            )

        # A condition the organization cannot use yet, e.g. one behind a feature, is
        # dropped here so that it does not cost the whole suggestion.
        common_conditions = [
            condition
            for condition in _get_common_conditions(project, [group.id for group in groups])
            if self._is_savable(request, project, _error_filter("", [condition]))
        ]

        filters = None
        if not organization.get_option("sentry:hide_ai_features", False):
            filters = suggest_filters_with_seer(
                errors, common_conditions, organization, acting_user_id(request.user)
            )

        def with_common_conditions(
            candidates: Sequence[SuggestedCustomInboundFilter],
        ) -> list[SuggestedCustomInboundFilter]:
            return [
                {**candidate, "conditions": [*candidate["conditions"], *common_conditions]}
                for candidate in candidates
            ]

        suggestions = with_common_conditions(filters) if filters else []
        if not suggestions or not all(
            self._is_savable(request, project, suggested) for suggested in suggestions
        ):
            suggestions = with_common_conditions(exact)
        return Response({"filters": suggestions})
