from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

import orjson
import sentry_sdk
from django.db.models import Exists, OuterRef, QuerySet
from taskbroker_client.retry import Retry

from sentry import features
from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.utils import DYNAMIC_SAMPLING_FEATURE
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY = "ds::per_org:orgs_with_dynamic_sampling"
# Long enough that an hourly refresh can fail for most of a day before the scheduler
# loses its filter, short enough that an abandoned key does not outlive the pipeline.
CACHE_TTL = timedelta(hours=24)
REFRESH_INTERVAL = timedelta(hours=1)
CHUNK_SIZE = 10_000


def candidate_organizations() -> QuerySet[Organization]:
    """
    The single definition of the population, so the cache is built from the same rows the
    scheduler filters. A mismatch here would silently drop organizations from the pipeline.
    """
    return Organization.objects.filter(
        Exists(
            Project.objects.filter(
                organization_id=OuterRef("pk"),
                status=ObjectStatus.ACTIVE,
            )
        ),
        status=OrganizationStatus.ACTIVE,
    )


def get_orgs_with_dynamic_sampling() -> list[int] | None:
    """
    None means "unknown", not "none of them". Callers must fall back to the unfiltered
    population, because a cold cache would otherwise stop the pipeline entirely.
    """
    try:
        cached = get_redis_client_for_ds().get(ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY)
        org_ids = None if cached is None else [int(org_id) for org_id in orjson.loads(cached)]
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        org_ids = None

    metrics.incr(
        "dynamic_sampling.per_org.feature_cache.read",
        tags={"result": "miss" if org_ids is None else "hit"},
    )
    return org_ids


def _orgs_with_dynamic_sampling(organizations: Sequence[Organization]) -> list[int]:
    # A None result means the check failed, which would otherwise read as "none of them".
    results = features.batch_has_for_organizations(DYNAMIC_SAMPLING_FEATURE, organizations)
    if results is None:
        raise RuntimeError(f"Unable to evaluate {DYNAMIC_SAMPLING_FEATURE} for a batch of orgs")

    return [org.id for org in organizations if results.get(f"organization:{org.id}", False)]


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.cache_dynamic_sampling_feature_flags",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=10 * 60,
    # A refresh still queued when the next one is due would write an older answer over a
    # newer one. Drop it and let the next run rebuild the entry.
    expires=REFRESH_INTERVAL,
    retry=Retry(times=2, delay=30),
    silo_mode=SiloMode.CELL,
)
def cache_dynamic_sampling_feature_flags() -> int:
    """
    An empty result leaves the previous entry in place. Every candidate losing the feature
    within one hour means the feature backend is answering wrongly, and serving that answer
    would stop the pipeline for everyone until the next successful refresh.
    """
    org_ids: list[int] = []
    for organizations in chunked(
        RangeQuerySetWrapper[Organization](candidate_organizations(), step=CHUNK_SIZE),
        CHUNK_SIZE,
    ):
        org_ids.extend(_orgs_with_dynamic_sampling(organizations))

    if not org_ids:
        logger.warning(
            "dynamic_sampling.per_org.feature_cache.empty_refresh",
            extra={"feature": DYNAMIC_SAMPLING_FEATURE},
        )
        metrics.incr("dynamic_sampling.per_org.feature_cache.empty_refresh")
        return 0

    get_redis_client_for_ds().set(
        ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY,
        orjson.dumps(org_ids),
        ex=int(CACHE_TTL.total_seconds()),
    )
    metrics.distribution(
        "dynamic_sampling.per_org.feature_cache.size",
        len(org_ids),
        sample_rate=1.0,
    )
    return len(org_ids)
