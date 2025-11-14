from typing import int
import uuid

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
    GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
)
from sentry.workflow_engine.models import Detector

MAX_UPTIME_SUBSCRIPTION_IDS = 100
"""
Maximum number of uptime subscription IDs that may be queried at once
"""


def authorize_and_map_uptime_detector_subscription_ids(
    detector_ids: list[str],
    projects: list[Project],
) -> tuple[dict[str, int], list[str]]:
    """
    Authorize the detector ids and return their corresponding subscription ids.

    For uptime detectors, we need to map detector -> data_source -> uptime_subscription.

    Args:
        detector_ids: List of Detector IDs as strings
        projects: List of Project objects the user has access to

    Returns:
        Tuple of:
        - Mapping from formatted subscription_id to detector_id
        - List of formatted subscription IDs for use in Snuba queries

    Raises:
        ValueError: If any of the provided IDs are invalid or unauthorized
    """
    detector_ids_ints = [int(id) for id in detector_ids]

    # First get detector -> uptime_subscription_id mapping
    detector_to_uptime_sub_id: dict[int, int] = {}
    for detector in Detector.objects.filter(
        status=ObjectStatus.ACTIVE,
        project_id__in=[project.id for project in projects],
        id__in=detector_ids_ints,
        type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
        data_sources__type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
    ).values("id", "data_sources__source_id"):
        try:
            uptime_sub_id = int(detector["data_sources__source_id"])
            detector_to_uptime_sub_id[detector["id"]] = uptime_sub_id
        except (ValueError, TypeError):
            continue

    # Get all the uptime subscription IDs we found and their subscription_ids
    uptime_sub_ids: list[int] = list(detector_to_uptime_sub_id.values())
    uptime_id_to_subscription_id: dict[int, str | None] = dict(
        UptimeSubscription.objects.filter(id__in=uptime_sub_ids).values_list(
            "id", "subscription_id"
        )[:]
    )

    # Build the final mapping: detector_id -> subscription_id
    detectors_with_data_sources: list[tuple[int, str]] = []
    for detector_id, uptime_sub_id in detector_to_uptime_sub_id.items():
        subscription_id = uptime_id_to_subscription_id.get(uptime_sub_id)
        if subscription_id:
            detectors_with_data_sources.append((detector_id, subscription_id))

    validated_detector_ids = {
        detector_data[0]
        for detector_data in detectors_with_data_sources
        if detector_data[0] is not None
    }

    if set(detector_ids_ints) != validated_detector_ids:
        raise ValueError("Invalid detector ids provided")

    sub_id_formatter = lambda sub_id: uuid.UUID(sub_id).hex

    subscription_id_to_detector_id = {
        sub_id_formatter(detector_data[1]): detector_data[0]
        for detector_data in detectors_with_data_sources
        if detector_data[0] is not None and detector_data[1] is not None
    }

    validated_subscription_ids = [
        sub_id_formatter(detector_data[1])
        for detector_data in detectors_with_data_sources
        if detector_data[1] is not None
    ]

    return subscription_id_to_detector_id, validated_subscription_ids
