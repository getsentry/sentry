from collections.abc import Sequence
from datetime import timedelta

import sentry_sdk
from django.utils import timezone

from sentry.models.files import FileBlob, FileBlobOwner


def find_missing_chunks(organization_id: int, chunks: Sequence[str]):
    """Returns a list of chunks which are missing for an org."""
    # Refresh the timestamp of all files we are interested in, so they don't disappear from under us.
    with sentry_sdk.start_span(op="find_missing_chunks") as span:
        span.set_tag("organization_id", organization_id)
        span.set_data("chunks_size", len(chunks))

        now = timezone.now()
        threshold = now - timedelta(hours=12)

        with sentry_sdk.start_span(op="find_missing_chunks.update_timestamp"):
            FileBlob.objects.filter(checksum__in=chunks, timestamp__lte=threshold).update(
                timestamp=now
            )

        # Compute the set of all existing chunks.
        with sentry_sdk.start_span(op="find_missing_chunks.get_owned_chunks"):
            owned = set(
                FileBlobOwner.objects.filter(
                    blob__checksum__in=chunks, organization_id=organization_id
                ).values_list("blob__checksum", flat=True)
            )

    return list(set(chunks) - owned)
