from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

import sentry_sdk

from sentry import features, options
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_DISPATCH_STEP_SECONDS = 37
NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=4)

FEATURE_NAMES = [
    "organizations:seer-night-shift",
    "organizations:gen-ai-features",
]


@instrumented_task(
    name="sentry.tasks.seer.night_shift.schedule_night_shift",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
)
def schedule_night_shift() -> None:
    """
    Nightly scheduler: iterates active orgs in batches, checks feature flags
    in bulk, and dispatches per-org worker tasks with jitter.
    """
    if not options.get("seer.night_shift.enable"):
        return

    spread_seconds = int(NIGHT_SHIFT_SPREAD_DURATION.total_seconds())
    batch_index = 0

    for org_batch in chunked(
        RangeQuerySetWrapper[Organization](
            Organization.objects.filter(status=OrganizationStatus.ACTIVE),
            step=1000,
        ),
        100,
    ):
        eligible_ids = _get_eligible_org_ids_from_batch(org_batch)

        org_map = {org.id: org for org in org_batch}
        for org_id in eligible_ids:
            org = org_map[org_id]

            if bool(org.get_option("sentry:hide_ai_features")):
                continue

            delay = (batch_index * NIGHT_SHIFT_DISPATCH_STEP_SECONDS) % spread_seconds

            run_night_shift_for_org.apply_async(
                args=[org_id],
                countdown=delay,
            )
            batch_index += 1

    logger.info(
        "night_shift.schedule_complete",
        extra={"orgs_dispatched": batch_index},
    )


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_for_org(organization_id: int) -> None:
    try:
        organization = Organization.objects.get(
            id=organization_id, status=OrganizationStatus.ACTIVE
        )
    except Organization.DoesNotExist:
        return

    sentry_sdk.set_tags(
        {
            "organization_id": organization.id,
            "organization_slug": organization.slug,
        }
    )

    logger.info(
        "night_shift.org_dispatched",
        extra={
            "organization_id": organization_id,
            "organization_slug": organization.slug,
        },
    )


def _get_eligible_org_ids_from_batch(
    orgs: Sequence[Organization],
) -> list[int]:
    """
    Check feature flags for a batch of orgs using batch_has_for_organizations.
    Returns org IDs that have all required feature flags enabled.
    """
    eligible = {org.id for org in orgs}

    for feature_name in FEATURE_NAMES:
        batch_result = features.batch_has_for_organizations(feature_name, orgs)
        if batch_result is None:
            batch_result = {
                f"organization:{org.id}": features.has(feature_name, org) for org in orgs
            }

        passing = {org.id for org in orgs if batch_result.get(f"organization:{org.id}", False)}
        eligible &= passing

        if not eligible:
            return []

    return list(eligible)
