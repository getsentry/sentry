import logging
from typing import Any

from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.variants import BaseVariant, ComponentVariant, SaltedComponentVariant
from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def get_grouping_info(
    grouping_config: StrategyConfiguration, project: Project, event: Event | GroupEvent
) -> dict[str, Any]:
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

    for variant_dict in grouping_info["variants"].values():
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


def _get_new_description(variant: BaseVariant) -> str:
    """
    Get a human-readable description of the grouping method for use in the grouping info section of
    the issue details page.

    TODO: As a first step, we're replacing the description only in grouping info, at the last minute
    before we return the API response. Once we switch to using key rather than description
    elsewhere, this can replace the existing `description` logic.
    """

    description_by_key = {
        "built_in_fingerprint": "Sentry-defined fingerprint",
        "chained_exception_message": "chained exception messages",
        "chained_exception_stacktrace": "chained exception stacktraces",
        "chained_exception_type": "chained exception types",
        "chained_ns_error": "chained NSErrors",
        "checksum": "checksum",
        "csp_local_script_violation": "directive",
        "csp_url": "directive and URL",
        "custom_fingerprint": "custom fingerprint",
        "exception": "exception",  # TODO: hotfix for case in which nothing in the exception contributes
        "exception_message": "exception message",
        "exception_stacktrace": "exception stacktrace",
        "exception_type": "exception type",
        "expect_ct": "hostname",
        "expect_staple": "hostname",
        "fallback": "fallback grouping",
        "hashed_checksum": "hashed checksum",
        "hpkp": "hostname",
        "message": "message",
        "ns_error": "NSError",
        "stacktrace": "event-level stacktrace",
        "template": "filename and context line",
        "thread_stacktrace": "thread stacktrace",
    }
    variant_name = variant.variant_name
    # For component variants, we grab the key from the root component rather than the variant itself
    # because that way we don't have to strip off variant name and (in the case of salted component
    # variants) the hybrid fingerprint designation. (We handle both of those separately below.)
    key = variant.root_component.key if isinstance(variant, ComponentVariant) else variant.key
    grouping_method = description_by_key[key]

    description_parts = [grouping_method]
    if "stacktrace" in key and variant_name in ["app", "system"]:
        stacktrace_descriptor = "— in-app frames" if variant_name == "app" else "— all frames"
        description_parts.append(stacktrace_descriptor)

    if isinstance(variant, SaltedComponentVariant):
        description_parts.append("and custom fingerprint")

    return " ".join(description_parts)


# TODO: Switch Seer stacktrace string to use variants directly, and then this can go away
def get_grouping_info_from_variants_legacy(
    variants: dict[str, BaseVariant],
) -> dict[str, dict[str, Any]]:
    return {key: {"key": key, **variant.as_dict()} for key, variant in variants.items()}


def get_grouping_info_from_variants(
    variants: dict[str, BaseVariant],
) -> dict[str, Any]:
    """
    Given a dictionary of variant objects, create and return a copy of the dictionary in which each
    variant object value has been transformed into an equivalent dictionary value, which knows the
    key under which it lives.
    """

    grouping_config_id = None
    for variant in variants.values():
        grouping_config_id = variant.config.id if hasattr(variant, "config") else None
        if grouping_config_id:
            break

    variants_json = {
        # Overwrite the description with a new, improved version
        variant.key: {
            **variant.as_dict(),
            "description": _get_new_description(variant),
        }
        for variant in variants.values()
    }

    return {
        "grouping_config": grouping_config_id,
        "variants": variants_json,
    }
