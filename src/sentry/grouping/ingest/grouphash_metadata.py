from __future__ import annotations

import logging
import random
from typing import Any, TypeIs, cast

from sentry import features, options
from sentry.eventstore.models import Event
from sentry.grouping.api import get_contributing_variant_and_component
from sentry.grouping.component import (
    ChainedExceptionGroupingComponent,
    CSPGroupingComponent,
    ExceptionGroupingComponent,
    ExpectCTGroupingComponent,
    ExpectStapleGroupingComponent,
    HPKPGroupingComponent,
    MessageGroupingComponent,
    StacktraceGroupingComponent,
    TemplateGroupingComponent,
    ThreadsGroupingComponent,
)
from sentry.grouping.variants import (
    BaseVariant,
    ChecksumVariant,
    ComponentVariant,
    CustomFingerprintVariant,
    HashedChecksumVariant,
    SaltedComponentVariant,
    VariantsByDescriptor,
)
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata, HashBasis
from sentry.models.project import Project
from sentry.types.grouphash_metadata import (
    ChecksumHashingMetadata,
    FallbackHashingMetadata,
    FingerprintHashingMetadata,
    HashingMetadata,
    MessageHashingMetadata,
    SecurityHashingMetadata,
    StacktraceHashingMetadata,
    TemplateHashingMetadata,
)
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


GROUPING_METHODS_BY_DESCRIPTION = {
    # All frames from a stacktrace at the top level of the event, in `exception`, or in
    # `threads` (top-level stacktraces come, for example, from using `attach_stacktrace`
    # together with `capture_message`)
    "stack-trace": HashBasis.STACKTRACE,
    "exception stack-trace": HashBasis.STACKTRACE,
    "thread stack-trace": HashBasis.STACKTRACE,
    # Same as above, but restricted to in-app frames
    "in-app stack-trace": HashBasis.STACKTRACE,
    "in-app exception stack-trace": HashBasis.STACKTRACE,
    "in-app thread stack-trace": HashBasis.STACKTRACE,
    # The value in `message` or `log_entry`, such as from using `capture_message` or calling
    # `capture_exception` on a string
    "message": HashBasis.MESSAGE,
    # Error type and value, in cases where all frames are ignored by stacktrace rules
    "exception": HashBasis.MESSAGE,
    # Error type and value, in cases where there's no stacktrace
    "in-app exception": HashBasis.MESSAGE,
    # Fingerprint set by the user, either in the client or using server-side fingerprinting rules
    "custom fingerprint": HashBasis.FINGERPRINT,
    # Fingerprint set by our server-side fingerprinting rules
    "Sentry defined fingerprint": HashBasis.FINGERPRINT,
    # Security reports (CSP, expect-ct, and the like)
    "URL": HashBasis.SECURITY_VIOLATION,
    "hostname": HashBasis.SECURITY_VIOLATION,
    # CSP reports of `unsafe-inline` and `unsafe-eval` violations
    "violation": HashBasis.SECURITY_VIOLATION,
    # Django template errors, which don't report a full stacktrace
    "template": HashBasis.TEMPLATE,
    # Hash set directly on the event by the client, under the key `checksum`
    "legacy checksum": HashBasis.CHECKSUM,
    "hashed legacy checksum": HashBasis.CHECKSUM,
    # No other method worked, probably because of a lack of usable data
    "fallback": HashBasis.FALLBACK,
}

# TODO: For now not including `csp_directive` and `csp_script_violation` - let's see if we end up
# wanting them
METRICS_TAGS_BY_HASH_BASIS = {
    HashBasis.STACKTRACE: ["stacktrace_type", "stacktrace_location"],
    HashBasis.MESSAGE: ["message_source", "message_parameterized"],
    HashBasis.FINGERPRINT: ["fingerprint_source"],
    HashBasis.SECURITY_VIOLATION: ["security_report_type"],
    HashBasis.TEMPLATE: [],
    HashBasis.CHECKSUM: [],
    HashBasis.FALLBACK: ["fallback_reason"],
    HashBasis.UNKNOWN: [],
}


def should_handle_grouphash_metadata(project: Project, grouphash_is_new: bool) -> bool:
    # Killswitches
    if not options.get("grouping.grouphash_metadata.ingestion_writes_enabled") or not features.has(
        "organizations:grouphash-metadata-creation", project.organization
    ):
        return False

    # While we're backfilling metadata for existing grouphash records, if the load is too high, we
    # want to prioritize metadata for new grouphashes because there's certain information
    # (timestamp, Seer data) which is only available at group creation time.
    if grouphash_is_new:
        return True
    else:
        return random.random() <= options.get("grouping.grouphash_metadata.backfill_sample_rate")


def create_or_update_grouphash_metadata_if_needed(
    event: Event,
    project: Project,
    grouphash: GroupHash,
    grouphash_is_new: bool,
    grouping_config: str,
    variants: dict[str, BaseVariant],
) -> None:
    # TODO: Do we want to expand this to backfill metadata for existing grouphashes? If we do,
    # we'll have to override the metadata creation date for them.

    if grouphash_is_new:
        new_data: dict[str, Any] = {"grouphash": grouphash}
        new_data.update(get_grouphash_metadata_data(event, project, variants, grouping_config))

        GroupHashMetadata.objects.create(**new_data)

    elif grouphash.metadata and grouphash.metadata.latest_grouping_config != grouping_config:
        # Keep track of the most recent config which computed this hash, so that once a
        # config is deprecated, we can clear out the GroupHash records which are no longer
        # being produced
        grouphash.metadata.update(latest_grouping_config=grouping_config)


def get_grouphash_metadata_data(
    event: Event,
    project: Project,
    variants: dict[str, BaseVariant],
    grouping_config: str,
) -> dict[str, Any]:
    base_data = {
        "latest_grouping_config": grouping_config,
        "platform": event.platform or "unknown",
    }
    hashing_metadata: HashingMetadata = {}
    # TODO: These are typed as `Any` so that we don't have to cast them to whatever specific
    # subtypes of `BaseVariant` and `GroupingComponent` (respectively) each of the helper calls
    # below requires. Casting once, to a type retrieved from a look-up, doesn't work, but maybe
    # there's a better way?
    contributors = get_contributing_variant_and_component(variants)
    contributing_variant: Any = contributors[0]
    contributing_component: Any = contributors[1]

    # Hybrid fingerprinting adds 'modified' to the beginning of the description of whatever method
    # was used before the extra fingerprint was added. We classify events with hybrid fingerprints
    # by the `{{ default }}` portion of their grouping, so strip the prefix before doing the
    # look-up.
    is_hybrid_fingerprint = contributing_variant.description.startswith("modified")
    method_description = contributing_variant.description.replace("modified ", "")

    with metrics.timer(
        "grouping.grouphashmetadata.get_grouphash_metadata_data"
    ) as metrics_timer_tags:
        try:
            hash_basis = GROUPING_METHODS_BY_DESCRIPTION[method_description]
        except KeyError:
            logger.exception(
                "Encountered unknown grouping method '%s'.",
                contributing_variant.description,
                extra={"project": project.id, "event_id": event.event_id},
            )
            return {**base_data, "hash_basis": HashBasis.UNKNOWN, "hashing_metadata": {}}

        metrics_timer_tags["hash_basis"] = hash_basis

        # Gather different metadata depending on the grouping method

        if hash_basis == HashBasis.STACKTRACE:
            hashing_metadata = _get_stacktrace_hashing_metadata(
                contributing_variant, contributing_component
            )

        elif hash_basis == HashBasis.MESSAGE:
            hashing_metadata = _get_message_hashing_metadata(contributing_component)

        elif hash_basis == HashBasis.FINGERPRINT:
            hashing_metadata = _get_fingerprint_hashing_metadata(contributing_variant)

        elif hash_basis == HashBasis.SECURITY_VIOLATION:
            hashing_metadata = _get_security_hashing_metadata(contributing_component)

        elif hash_basis == HashBasis.TEMPLATE:
            hashing_metadata = _get_template_hashing_metadata(contributing_component)

        elif hash_basis == HashBasis.CHECKSUM:
            hashing_metadata = _get_checksum_hashing_metadata(contributing_variant)

        elif hash_basis == HashBasis.FALLBACK:
            hashing_metadata = _get_fallback_hashing_metadata(
                # TODO: Once https://peps.python.org/pep-0728 is a thing (still in draft but
                # theoretically on track for 3.14), we can mark `VariantsByDescriptor` as closed and
                # annotate `variants` as a `VariantsByDescriptor` instance in the spot where it's
                # created and in all of the spots where it gets passed function to function.
                # (Without the closed-ness, the return values of `.items()` and `.values()` don't
                # get typed as `BaseVariant`, so for now we need to keep `variants` typed as
                # `dict[str, BaseVariant]` until we get here.)
                cast(VariantsByDescriptor, variants)
            )

        if is_hybrid_fingerprint:
            hashing_metadata.update(
                _get_fingerprint_hashing_metadata(contributing_variant, is_hybrid=True)
            )

        return {**base_data, "hash_basis": hash_basis, "hashing_metadata": hashing_metadata}


def record_grouphash_metadata_metrics(
    grouphash_metadata: GroupHashMetadata, platform: str | None
) -> None:
    # TODO: Once https://peps.python.org/pep-0728 is a thing (still in draft but theoretically on
    # track for 3.14), we can mark the various hashing metadata types as closed and that should
    # narrow the types for the tag values such that we can stop stringifying everything

    # TODO: For now, until we backfill data for pre-existing hashes, these metrics are going
    # to be somewhat skewed

    # Define a helper for this check so that it can double as a type guard
    def is_stacktrace_hashing(
        _hashing_metadata: HashingMetadata,
        hash_basis: str,
    ) -> TypeIs[StacktraceHashingMetadata]:
        return hash_basis == HashBasis.STACKTRACE

    hash_basis = grouphash_metadata.hash_basis
    hashing_metadata = grouphash_metadata.hashing_metadata

    if hash_basis:
        hash_basis_tags: dict[str, str | None] = {"hash_basis": hash_basis, "platform": platform}
        if hashing_metadata:
            hash_basis_tags["is_hybrid_fingerprint"] = str(
                hashing_metadata.get("is_hybrid_fingerprint", False)
            )
        metrics.incr(
            "grouping.grouphashmetadata.event_hash_basis", sample_rate=1.0, tags=hash_basis_tags
        )

        if hashing_metadata:
            hashing_metadata_tags: dict[str, str | bool] = {
                tag: str(hashing_metadata.get(tag))
                for tag in METRICS_TAGS_BY_HASH_BASIS[hash_basis]
            }
            if is_stacktrace_hashing(hashing_metadata, hash_basis):
                hashing_metadata_tags["chained_exception"] = str(
                    int(hashing_metadata.get("num_stacktraces", 1)) > 1
                )
            if hashing_metadata_tags:
                metrics.incr(
                    f"grouping.grouphashmetadata.event_hashing_metadata.{hash_basis}",
                    sample_rate=1.0,
                    tags={
                        **hashing_metadata_tags,
                        # Add this in at the end so it's not the reason we log the metric if it's
                        # the only tag we have
                        "platform": platform,
                    },
                )


def _get_stacktrace_hashing_metadata(
    contributing_variant: ComponentVariant,
    contributing_component: (
        StacktraceGroupingComponent
        | ExceptionGroupingComponent
        | ChainedExceptionGroupingComponent
        | ThreadsGroupingComponent
    ),
) -> StacktraceHashingMetadata:
    return {
        "stacktrace_type": "in_app" if contributing_variant.variant_name == "app" else "system",
        "stacktrace_location": (
            "exception"
            if "exception" in contributing_variant.description
            else "thread" if "thread" in contributing_variant.description else "top-level"
        ),
        "num_stacktraces": (
            len(contributing_component.values)
            if contributing_component.id == "chained-exception"
            else 1
        ),
    }


def _get_message_hashing_metadata(
    contributing_component: (
        MessageGroupingComponent | ExceptionGroupingComponent | ChainedExceptionGroupingComponent
    ),
) -> MessageHashingMetadata:
    # In the simplest case, we already have the component we need to check
    if isinstance(contributing_component, MessageGroupingComponent):
        return {
            "message_source": "message",
            "message_parameterized": (
                contributing_component.hint == "stripped event-specific values"
            ),
        }

    # Otherwise, we have to look in the nested structure to figure out if the message was
    # parameterized. If it's a single exception, we can just check its subcomponents directly, but
    # if it's a chained exception we have to dig in an extra level, and look at the subcomponents of
    # all of its children. (The subcomponents are things like stacktrace, error type, error value,
    # etc.)
    exceptions_to_check: list[ExceptionGroupingComponent] = []
    if isinstance(contributing_component, ChainedExceptionGroupingComponent):
        exceptions = contributing_component.values
        exceptions_to_check = [exception for exception in exceptions if exception.contributes]
    else:
        exception = contributing_component
        exceptions_to_check = [exception]

    for exception in exceptions_to_check:
        for subcomponent in exception.values:
            if subcomponent.contributes and subcomponent.hint == "stripped event-specific values":
                return {"message_source": "exception", "message_parameterized": True}

    return {"message_source": "exception", "message_parameterized": False}


def _get_fingerprint_hashing_metadata(
    contributing_variant: CustomFingerprintVariant | SaltedComponentVariant, is_hybrid: bool = False
) -> FingerprintHashingMetadata:
    client_fingerprint = contributing_variant.info.get("client_fingerprint")
    matched_rule = contributing_variant.info.get("matched_rule")

    metadata: FingerprintHashingMetadata = {
        # For simplicity, we stringify fingerprint values (which are always lists) to keep
        # `hashing_metadata` a flat structure
        "fingerprint": json.dumps(contributing_variant.values),
        "fingerprint_source": (
            "client"
            if not matched_rule
            else (
                "server_builtin_rule"
                if contributing_variant.type == "built_in_fingerprint"
                else "server_custom_rule"
            )
        ),
        "is_hybrid_fingerprint": is_hybrid,
    }

    # Note that these two conditions are not mutually exclusive - you can set a fingerprint in the
    # SDK and have your event match a server-based rule (in which case the latter will take
    # precedence)
    if matched_rule:
        metadata["matched_fingerprinting_rule"] = matched_rule["text"]
    if client_fingerprint:
        metadata["client_fingerprint"] = json.dumps(client_fingerprint)

    return metadata


def _get_security_hashing_metadata(
    contributing_component: (
        CSPGroupingComponent
        | ExpectCTGroupingComponent
        | ExpectStapleGroupingComponent
        | HPKPGroupingComponent
    ),
) -> SecurityHashingMetadata:
    subcomponents_by_id = {
        subcomponent.id: subcomponent for subcomponent in contributing_component.values
    }
    blocked_host_key = "uri" if contributing_component.id == "csp" else "hostname"

    metadata: SecurityHashingMetadata = {
        "security_report_type": contributing_component.id,
        # Having a string which includes the "this is a string" quotes is a *real* footgun in terms
        # of querying, so strip those off before storing the value
        "blocked_host": subcomponents_by_id[blocked_host_key].values[0].strip("'"),
    }

    if contributing_component.id == "csp":
        metadata["csp_directive"] = subcomponents_by_id["salt"].values[0]
        if subcomponents_by_id["violation"].contributes:
            metadata["csp_script_violation"] = subcomponents_by_id["violation"].values[0].strip("'")

    return metadata


def _get_template_hashing_metadata(
    contributing_component: TemplateGroupingComponent,
) -> TemplateHashingMetadata:
    metadata: TemplateHashingMetadata = {}

    subcomponents_by_id = {
        subcomponent.id: subcomponent for subcomponent in contributing_component.values
    }

    if subcomponents_by_id["filename"].values:
        metadata["template_name"] = subcomponents_by_id["filename"].values[0]
    if subcomponents_by_id["context-line"].values:
        metadata["template_context_line"] = subcomponents_by_id["context-line"].values[0]

    return metadata


def _get_checksum_hashing_metadata(
    contributing_variant: ChecksumVariant | HashedChecksumVariant,
) -> ChecksumHashingMetadata:
    metadata: ChecksumHashingMetadata = {"checksum": contributing_variant.checksum}

    if isinstance(contributing_variant, HashedChecksumVariant):
        metadata["raw_checksum"] = contributing_variant.raw_checksum

    return metadata


def _get_fallback_hashing_metadata(
    variants: VariantsByDescriptor,
) -> FallbackHashingMetadata:
    # TODO: All of the specific cases handled below relate to stacktrace frames. Let's how often we
    # land in the `other` category and then we can decide how much further it's worthwhile to break
    # it down.

    if (
        "app" in variants
        and variants["app"].component.values[0].hint == "ignored because it contains no frames"
    ):
        reason = "no_frames"

    elif (
        "system" in variants
        and variants["system"].component.values[0].hint
        == "ignored because it contains no contributing frames"
    ):
        reason = "no_contributing_frames"

    elif "system" in variants and "min-frames" in (
        variants["system"].component.values[0].hint or ""
    ):
        reason = "insufficient_contributing_frames"

    else:
        reason = "other"

    return {"fallback_reason": reason}


def check_grouphashes_for_positive_fingerprint_match(
    grouphash1: GroupHash, grouphash2: GroupHash
) -> bool:
    """
    Given two grouphashes, see if a) they both have associated fingerprints, and b) if their
    resolved fingerprints match.

    Returns False if either grouphash doesn't have an associated fingerprint. (In other words, both
    fingerprints being None doesn't count as a match.)
    """
    fingerprint1 = grouphash1.get_associated_fingerprint()
    fingerprint2 = grouphash2.get_associated_fingerprint()

    if not fingerprint1 or not fingerprint2:
        return False

    return fingerprint1 == fingerprint2
