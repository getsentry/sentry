import logging
from typing import Any

from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.variants import BaseVariant
from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def get_grouping_info(
    grouping_config: StrategyConfiguration, project: Project, event: Event | GroupEvent
) -> dict[str, dict[str, Any]]:
    # We always fetch the stored hashes here. The reason for this is
    # that we want to show in the UI if the forced grouping algorithm
    # produced hashes that would normally also appear in the event.
    hashes = event.get_hashes()

    variants = event.get_grouping_variants(grouping_config, normalize_stacktraces=True)

    grouping_info = get_grouping_info_from_variants(variants)

    # One place we use this info is in the grouping info section of the event details page, and for
    # that we recalculate hashes/variants on the fly since we don't store the variants as part of
    # event data. If the grouping config has been changed since the event was ingested, we may get
    # different hashes here than the ones stored on the event.
    _check_for_mismatched_hashes(event, project, grouping_info, hashes)

    return grouping_info


def _check_for_mismatched_hashes(
    event: Event | GroupEvent,
    project: Project,
    grouping_info: dict[str, dict[str, Any]],
    hashes: list[str],
) -> None:
    """
    Given a dictionary of variant data, check each variant's hash value to make sure it is `hashes`.

    The result is stored with each variant and recorded as a metric.
    """

    for variant_dict in grouping_info.values():
        hash_value = variant_dict["hash"]

        # Since the hashes are generated on the fly and might no
        # longer match the stored ones we indicate if the hash
        # generation caused the hash to mismatch.
        variant_dict["hashMismatch"] = hash_mismatch = (
            hash_value is not None and hash_value not in hashes
        )

        if hash_mismatch:
            metrics.incr("event_grouping_info.hash_mismatch")
            logger.error(
                "event_grouping_info.hash_mismatch",
                extra={"project_id": project.id, "event_id": event.event_id},
            )
        else:
            metrics.incr("event_grouping_info.hash_match")


def get_grouping_info_from_variants(
    variants: dict[str, BaseVariant],
    # Shim to keep the output (which we also use for getting the Seer stacktrace string) stable
    # until we can switch `get_stacktrace_string` to use variants directly
    use_legacy_format: bool = True,
) -> dict[str, dict[str, Any]]:
    """
    Given a dictionary of variant objects, create and return a copy of the dictionary in which each
    variant object value has been transformed into an equivalent dictionary value, which knows the
    key under which it lives.
    """

    return {key: {"key": key, **variant.as_dict()} for key, variant in variants.items()}
