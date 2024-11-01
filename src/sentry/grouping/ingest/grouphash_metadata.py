from __future__ import annotations

import logging

from sentry.eventstore.models import Event
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata, HashBasis
from sentry.models.project import Project

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
    # Django template errors, which don't report a full stacktrace
    "template": HashBasis.TEMPLATE,
    # Hash set directly on the event by the client, under the key `checksum`
    "legacy checksum": HashBasis.CHECKSUM,
    "hashed legacy checksum": HashBasis.CHECKSUM,
    # No other method worked, probably because of a lack of usable data
    "fallback": HashBasis.FALLBACK,
}


def create_or_update_grouphash_metadata(
    event: Event,
    project: Project,
    grouphash: GroupHash,
    created: bool,
    grouping_config: str,
    variants: dict[str, BaseVariant],
) -> None:
    # TODO: Do we want to expand this to backfill metadata for existing grouphashes? If we do,
    # we'll have to override the metadata creation date for them.

    if created:
        hash_basis = _get_hash_basis(event, project, variants)

        GroupHashMetadata.objects.create(
            grouphash=grouphash,
            latest_grouping_config=grouping_config,
            hash_basis=hash_basis,
        )
    elif grouphash.metadata and grouphash.metadata.latest_grouping_config != grouping_config:
        # Keep track of the most recent config which computed this hash, so that once a
        # config is deprecated, we can clear out the GroupHash records which are no longer
        # being produced
        grouphash.metadata.update(latest_grouping_config=grouping_config)


def _get_hash_basis(event: Event, project: Project, variants: dict[str, BaseVariant]) -> HashBasis:
    main_variant = (
        variants["app"]
        # TODO: We won't need this 'if' once we stop returning both app and system contributing
        # variants
        if "app" in variants and variants["app"].contributes
        else (
            variants["hashed-checksum"]
            # TODO: We won't need this 'if' once we stop returning both hashed and non-hashed
            # checksum contributing variants
            if "hashed-checksum" in variants
            # Other than in the broken app/system and hashed/raw checksum cases, there should only
            # ever be a single contributing variant
            else [variant for variant in variants.values() if variant.contributes][0]
        )
    )

    try:
        hash_basis = GROUPING_METHODS_BY_DESCRIPTION[
            # Hybrid fingerprinting adds 'modified' to the beginning of the description of whatever
            # method was used beore the extra fingerprint was added, so strip that off before
            # looking it up
            main_variant.description.replace("modified ", "")
        ]
    except KeyError:
        logger.exception(
            "Encountered unknown grouping method '%s'.",
            main_variant.description,
            extra={"project": project.id, "event": event.event_id},
        )
        hash_basis = HashBasis.UNKNOWN

    return hash_basis
