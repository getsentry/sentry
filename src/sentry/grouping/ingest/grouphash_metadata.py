from __future__ import annotations

from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata


def create_or_update_grouphash_metadata(
    grouphash: GroupHash,
    created: bool,
    grouping_config: str,
) -> None:
    # TODO: Do we want to expand this to backfill metadata for existing grouphashes? If we do,
    # we'll have to override the metadata creation date for them.

    if created:
        GroupHashMetadata.objects.create(
            grouphash=grouphash,
            latest_grouping_config=grouping_config,
        )
    elif grouphash.metadata and grouphash.metadata.latest_grouping_config != grouping_config:
        # Keep track of the most recent config which computed this hash, so that once a
        # config is deprecated, we can clear out the GroupHash records which are no longer
        # being produced
        grouphash.metadata.update(latest_grouping_config=grouping_config)
