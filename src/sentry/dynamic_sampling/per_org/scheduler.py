from __future__ import annotations

import random
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.db.models.functions import Mod
from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.calculations import (
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.configuration import (
    get_configuration,
)
from sentry.dynamic_sampling.per_org.gate import is_org_in_rollout
from sentry.dynamic_sampling.per_org.queries import (
    get_eap_organization_volume,
    get_eap_project_volumes,
    get_eap_transaction_volumes,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    DynamicSamplingStatus,
    emit_status,
    track_dynamic_sampling,
)
from sentry.dynamic_sampling.rules.utils import OrganizationId, get_redis_client_for_ds
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils.query import RangeQuerySetWrapper

BUCKET_COUNT = 10
JITTER_WINDOW_SECONDS = 60
BUCKET_CURSOR_KEY = "ds::per_org:bucket_cursor"


def _next_bucket_index() -> int:
    try:
        redis_client = get_redis_client_for_ds()
        bucket_index = (redis_client.incr(BUCKET_CURSOR_KEY) - 1) % BUCKET_COUNT
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return datetime.now(tz=timezone.utc).minute % BUCKET_COUNT
    return bucket_index


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.schedule_per_org_calculations",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60,
    retry=Retry(times=0),
    silo_mode=SiloMode.CELL,
)
@track_dynamic_sampling
def schedule_per_org_calculations() -> None:
    bucket_index = _next_bucket_index()
    bucket_tag = {"bucket_index": str(bucket_index)}
    dispatched = 0
    skipped = 0
    queryset = (
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
        .annotate(_bucket=Mod(F("id"), BUCKET_COUNT))
        .filter(_bucket=bucket_index)
        .values_list("id", flat=True)
    )
    org_ids = RangeQuerySetWrapper[int](
        queryset,
        step=1000,
        result_value_getter=lambda org_id: org_id,
    )

    for org_id in org_ids:
        if not is_org_in_rollout(org_id):
            skipped += 1
            continue
        run_calculations_per_org_task.apply_async(
            args=(org_id,),
            countdown=random.randint(0, JITTER_WINDOW_SECONDS),
        )
        dispatched += 1

    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        DynamicSamplingStatus.DISPATCHED,
        amount=dispatched,
        extra_tags=bucket_tag,
    )
    emit_status(
        SCHEDULER_BUCKET_ORG_STATUS_METRIC,
        DynamicSamplingStatus.ROLLOUT_EXCLUDED,
        amount=skipped,
        extra_tags=bucket_tag,
    )
    return None


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=2 * 60,  # 2 minute timeout per org
    silo_mode=SiloMode.CELL,
)
@track_dynamic_sampling
def run_calculations_per_org_task(org_id: OrganizationId) -> DynamicSamplingStatus | None:
    config = get_configuration(org_id)
    if not config.is_enabled:
        return DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
    if not config.projects:
        return DynamicSamplingStatus.ORG_HAS_NO_PROJECTS

    org_volume_5m = get_eap_organization_volume(config)
    if org_volume_5m is None:
        return DynamicSamplingStatus.NO_ORG_VOLUME

    project_volumes = get_eap_project_volumes(config)
    if not project_volumes:
        return DynamicSamplingStatus.NO_PROJECT_VOLUMES

    if config.should_balance_projects:
        rebalanced_projects = run_project_balancing(config, project_volumes)
        config.set_rebalanced_project_sample_rates(rebalanced_projects)
        cached_sample_rates = get_cached_rebalanced_project_sample_rates(config.organization.id)
        compare_rebalanced_projects_with_cache(config, rebalanced_projects, cached_sample_rates)

    transaction_volumes = get_eap_transaction_volumes(config)
    if not transaction_volumes:
        return DynamicSamplingStatus.NO_TRANSACTION_VOLUMES

    rebalanced_transactions = run_transaction_balancing(
        config, project_volumes, transaction_volumes
    )
    cached_transaction_sample_rates = get_cached_rebalanced_transaction_sample_rates(
        org_id=config.organization.id, project_ids=rebalanced_transactions.keys()
    )
    compare_rebalanced_transactions_with_cache(
        config, rebalanced_transactions, cached_transaction_sample_rates
    )

    return None
