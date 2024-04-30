import logging
from typing import Any

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.eventstore.models import Event
from sentry.grouping.api import GroupingConfigNotFound
from sentry.grouping.variants import BaseVariant, PerformanceProblemVariant
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.performance_issues.performance_detection import EventPerformanceProblem

logger = logging.getLogger(__name__)


def get_grouping_info(
    config_name: str | None, project: Project, event: Event
) -> dict[str, dict[str, Any]]:
    # We always fetch the stored hashes here.  The reason for this is
    # that we want to show in the UI if the forced grouping algorithm
    # produced hashes that would normally also appear in the event.
    hashes = event.get_hashes()

    try:
        if event.get_event_type() == "transaction":
            # Transactions events are grouped using performance detection. They
            # are not subject to grouping configs, and the only relevant
            # grouping variant is `PerformanceProblemVariant`.

            problems = EventPerformanceProblem.fetch_multi([(event, h) for h in hashes.hashes])

            # Create a variant for every problem associated with the event
            # TODO: Generate more unique keys, in case this event has more than
            # one problem of a given type
            variants: dict[str, BaseVariant] = {
                problem.problem.type.slug: PerformanceProblemVariant(problem)
                for problem in problems
                if problem
            }
        else:
            variants = event.get_grouping_variants(
                force_config=config_name, normalize_stacktraces=True
            )

    except GroupingConfigNotFound:
        raise ResourceDoesNotExist(detail="Unknown grouping config")

    return get_grouping_info_from_variants(
        event, project, variants, hashes.hashes, hashes.hierarchical_hashes
    )


def get_grouping_info_from_variants(
    event: Event,
    project: Project,
    variants: dict[str, Any],
    hashes: list[str],
    hierarchical_hashes: list[str],
) -> dict[str, dict[str, Any]]:
    grouping_info = {}

    for key, variant in variants.items():
        variant_dict = variant.as_dict()
        # Since the hashes are generated on the fly and might no
        # longer match the stored ones we indicate if the hash
        # generation caused the hash to mismatch.
        variant_dict["hashMismatch"] = hash_mismatch = (
            variant_dict["hash"] is not None
            and variant_dict["hash"] not in hashes
            and variant_dict["hash"] not in hierarchical_hashes
        )

        if hash_mismatch:
            metrics.incr("event_grouping_info.hash_mismatch")
            logger.error(
                "event_grouping_info.hash_mismatch",
                extra={"project_id": project.id, "event_id": event.event_id},
            )
        else:
            metrics.incr("event_grouping_info.hash_match")

        variant_dict["key"] = key
        grouping_info[key] = variant_dict

    return grouping_info
