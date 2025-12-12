from collections.abc import Callable
from typing import Any

from sentry import options
from sentry.utils import metrics


def should_double_read_from_eap() -> bool:
    return options.get("eap.occurrences.should_double_read")


def should_callsite_use_eap_data_in_read(callsite: str) -> bool:
    return callsite in options.get("eap.occurrences.callsites_using_eap_data_allowlist")


def validate_read(
    snuba_data: Any,
    eap_data: Any,
    callsite: str,
    is_null_result: bool | None = None,
    reasonable_match_comparator: Callable[[Any, Any], bool] | None = None,
) -> None:
    """
    Checks whether a read from EAP Occurrences matches exactly with a read from snuba.
    Inputs:
      * snuba_data: Some data from Snuba (e.g. dict[str, str])
      * eap_data: Some data from EAP (of format expecting to match snuba_data)
      * callsite: Where your read is taking place.
      * is_null_result: Whether the result is a "null result" (e.g. empty array). This
          helps us to determine whether a "match" is significant.
      * reasonable_match_comparator: None, or a function taking snuba_data & eap_data and
          returning True if the read is "reasonable" and False otherwise.
    """
    tags = {
        "callsite": callsite,
        "exact_match": snuba_data == eap_data,
        "source_of_truth": "eap" if should_callsite_use_eap_data_in_read(callsite) else "snuba",
    }

    if is_null_result is not None:
        tags["is_null_result"] = is_null_result

    if reasonable_match_comparator is not None:
        tags["reasonable_match"] = reasonable_match_comparator(snuba_data, eap_data)

    metrics.incr(
        "eap.occurrences.validate_reads",
        tags=tags,
    )
