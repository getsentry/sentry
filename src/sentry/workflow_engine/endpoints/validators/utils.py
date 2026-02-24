import logging
from typing import Any

from django.forms import ValidationError
from jsonschema import ValidationError as JsonValidationError
from jsonschema import validate

from sentry.constants import ObjectStatus
from sentry.issues import grouptype
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)


def log_alerting_quota_hit(
    object_type: str, organization: Organization, actor: User | RpcUser | None
) -> None:
    """Call when a create request is rejected because an org has reached its quota for object_type."""
    logger.info(
        "workflow_engine.quota.limit_hit",
        extra={
            "object_type": object_type,
            "organization_id": organization.id,
            "organization_slug": organization.slug,
            "actor_id": actor.id if actor is not None else None,
        },
    )
    metrics.incr("workflow_engine.quota.limit_hit", tags={"object_type": object_type})


def toggle_detector(detector: Detector, enabled: bool) -> None:
    updated_detector_status = ObjectStatus.ACTIVE if enabled else ObjectStatus.DISABLED
    detector.update(status=updated_detector_status)
    detector.update(enabled=enabled)


def validate_json_schema(value: Any, schema: Any) -> Any:
    try:
        validate(value, schema)
    except JsonValidationError as e:
        raise ValidationError(str(e))

    return value


def validate_json_primitive(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        raise ValidationError(
            f"Invalid json primitive value: {value}. Must be a string, number, or boolean."
        )

    return value


def remove_items_by_api_input(
    input_data: list[dict[str, Any]], instance: Any, values_list_field: str
) -> None:
    data_ids = {int(item["id"]) for item in input_data if item.get("id") is not None}
    stored_ids = set(instance.values_list(values_list_field, flat=True))
    has_items_removed = data_ids != stored_ids

    if has_items_removed:
        filter_kwargs = {f"{values_list_field}__in": data_ids}
        instance.exclude(**filter_kwargs).delete()


def get_unknown_detector_type_error(bad_value: str, organization: Organization) -> str:
    available_types = [
        gt.slug
        for gt in grouptype.registry.get_visible(organization)
        if gt.detector_settings is not None and gt.detector_settings.validator is not None
    ]
    available_types.sort()

    if available_types:
        available_str = ", ".join(available_types)
        return f"Unknown detector type '{bad_value}'. Must be one of: {available_str}"
    else:
        return f"Unknown detector type '{bad_value}'. No detector types are available."
