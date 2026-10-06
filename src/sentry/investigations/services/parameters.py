from __future__ import annotations

import math
from collections.abc import Set as AbstractSet
from datetime import timedelta
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.investigations.models import InvestigationParameterType
from sentry.investigations.templates.types import TemplateParameterSpec


class ParameterValidationError(ValueError):
    pass


def validate_parameter_value(
    *,
    parameter_type: str,
    value: Any,
    constraints: dict[str, Any],
    accessible_project_ids: AbstractSet[int] | None = None,
) -> Any:
    if parameter_type == InvestigationParameterType.STRING:
        if not isinstance(value, str):
            raise ParameterValidationError("Must be a string.")
        max_length = constraints.get("maxLength")
        if max_length is not None and len(value) > max_length:
            raise ParameterValidationError(f"Must contain at most {max_length} characters.")
        return value

    if parameter_type == InvestigationParameterType.NUMBER:
        if isinstance(value, bool) or not isinstance(value, int | float):
            raise ParameterValidationError("Must be a number.")
        if isinstance(value, float) and not math.isfinite(value):
            raise ParameterValidationError("Must be a finite number.")
        if "min" in constraints and value < constraints["min"]:
            raise ParameterValidationError(f"Must be at least {constraints['min']}.")
        if "max" in constraints and value > constraints["max"]:
            raise ParameterValidationError(f"Must be at most {constraints['max']}.")
        return value

    if parameter_type == InvestigationParameterType.BOOLEAN:
        if not isinstance(value, bool):
            raise ParameterValidationError("Must be a boolean.")
        return value

    if parameter_type == InvestigationParameterType.ENUM:
        if value not in constraints.get("options", []):
            raise ParameterValidationError("Must be one of the declared options.")
        return value

    if parameter_type == InvestigationParameterType.DURATION:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ParameterValidationError("Must be an integer number of seconds.")
        if "min" in constraints and value < constraints["min"]:
            raise ParameterValidationError(f"Must be at least {constraints['min']} seconds.")
        if "max" in constraints and value > constraints["max"]:
            raise ParameterValidationError(f"Must be at most {constraints['max']} seconds.")
        return value

    if parameter_type == InvestigationParameterType.DATETIME_RANGE:
        if not isinstance(value, dict) or set(value) != {"start", "end"}:
            raise ParameterValidationError("Must contain exactly start and end.")
        start = parse_datetime(value["start"]) if isinstance(value["start"], str) else None
        end = parse_datetime(value["end"]) if isinstance(value["end"], str) else None
        if (
            start is None
            or end is None
            or not timezone.is_aware(start)
            or not timezone.is_aware(end)
        ):
            raise ParameterValidationError("Start and end must be timezone-aware ISO datetimes.")
        if start >= end:
            raise ParameterValidationError("Start must be before end.")
        max_days = constraints.get("maxDays")
        if max_days is not None and end - start > timedelta(days=max_days):
            raise ParameterValidationError(f"Range must not exceed {max_days} days.")
        return {"start": start.isoformat(), "end": end.isoformat()}

    if parameter_type == InvestigationParameterType.PROJECT:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ParameterValidationError("Must be a project ID.")
        if accessible_project_ids is not None and value not in accessible_project_ids:
            raise ParameterValidationError("Project is inaccessible.")
        return value

    if parameter_type == InvestigationParameterType.PROJECT_LIST:
        if not isinstance(value, list) or any(
            isinstance(item, bool) or not isinstance(item, int) for item in value
        ):
            raise ParameterValidationError("Must be a list of project IDs.")
        if len(set(value)) != len(value):
            raise ParameterValidationError("Project IDs must be unique.")
        if accessible_project_ids is not None and not set(value).issubset(accessible_project_ids):
            raise ParameterValidationError("One or more projects are inaccessible.")
        return value

    if parameter_type == InvestigationParameterType.ENVIRONMENT_LIST:
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            raise ParameterValidationError("Must be a list of environment names.")
        if len(set(value)) != len(value):
            raise ParameterValidationError("Environment names must be unique.")
        max_items = constraints.get("maxItems")
        if max_items is not None and len(value) > max_items:
            raise ParameterValidationError(f"Must contain at most {max_items} environments.")
        return value

    raise ParameterValidationError("Unsupported parameter type.")


def validate_template_parameters(
    specs: tuple[TemplateParameterSpec, ...],
    supplied: dict[str, Any],
    *,
    accessible_project_ids: AbstractSet[int] | None = None,
) -> dict[str, Any]:
    declared = {spec.key: spec for spec in specs}
    extra = sorted(set(supplied) - set(declared))
    if extra:
        raise ParameterValidationError(f"Unknown parameters: {', '.join(extra)}.")

    resolved: dict[str, Any] = {}
    for spec in specs:
        if spec.key in supplied:
            value = supplied[spec.key]
            if value is None and spec.required:
                raise ParameterValidationError(f"Missing required parameter: {spec.key}.")
        elif spec.default_value is not None:
            value = spec.default_value
        elif spec.required:
            raise ParameterValidationError(f"Missing required parameter: {spec.key}.")
        else:
            value = None

        if value is not None:
            value = validate_parameter_value(
                parameter_type=spec.type,
                value=value,
                constraints=spec.constraints,
                accessible_project_ids=accessible_project_ids,
            )
        resolved[spec.key] = value

    return resolved
