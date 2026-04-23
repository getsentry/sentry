"""Per-org orchestrator.

One cycle of dynamic-sampling calculations for a single organization, run
end-to-end in a single worker invocation. Each phase lives in its own module
under `tasks.steps.*`; this file only wires them together and owns the
cross-cutting concerns (org lookup, feature gate, volume short-circuit,
top-level timing metric).
"""

from __future__ import annotations

from taskbroker_client.retry import Retry

from sentry.dynamic_sampling.per_org.tasks.gate import is_killswitch_engaged, is_org_in_rollout
from sentry.dynamic_sampling.per_org.tasks.steps.boost_low_volume_projects import (
    boost_low_volume_projects,
)
from sentry.dynamic_sampling.per_org.tasks.steps.boost_low_volume_transactions import (
    boost_low_volume_transactions,
)
from sentry.dynamic_sampling.per_org.tasks.steps.eap_batch import run_eap_batch
from sentry.dynamic_sampling.per_org.tasks.steps.outcomes_volume import (
    fetch_outcomes_volume,
    has_recent_volume,
)
from sentry.dynamic_sampling.per_org.tasks.steps.recalibration import apply_recalibration
from sentry.dynamic_sampling.per_org.tasks.steps.sliding_window import apply_sliding_window
from sentry.dynamic_sampling.rules.utils import OrganizationId
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.utils import metrics


def run_calculations_per_org(org_id: OrganizationId) -> None:
    if is_killswitch_engaged():
        metrics.incr(
            "dynamic_sampling.run_calculations_per_org.killswitch_engaged",
            sample_rate=1,
        )
        return

    if not is_org_in_rollout(org_id):
        metrics.incr(
            "dynamic_sampling.run_calculations_per_org.skipped_by_rollout",
            sample_rate=1,
        )
        return

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return

    if not has_dynamic_sampling(organization):
        return

    with metrics.timer("dynamic_sampling.run_calculations_per_org.duration"):
        outcomes = fetch_outcomes_volume(org_id, organization)
        if not has_recent_volume(outcomes):
            metrics.incr(
                "dynamic_sampling.per_org.skipped_no_volume",
                sample_rate=1,
            )
            return

        eap = run_eap_batch(org_id, organization)

        apply_sliding_window(org_id, organization, eap)
        apply_recalibration(org_id, organization, outcomes)
        boost_low_volume_projects(org_id, organization, eap)
        boost_low_volume_transactions(org_id, organization, eap)


@instrumented_task(
    name="sentry.dynamic_sampling.per_org.run_calculations_per_org",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=20 * 60 + 5,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.CELL,
)
@dynamic_sampling_task
def run_calculations_per_org_task(org_id: OrganizationId) -> None:
    run_calculations_per_org(org_id)
