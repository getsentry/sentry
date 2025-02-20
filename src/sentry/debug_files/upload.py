from collections.abc import Sequence
from datetime import timedelta

import sentry_sdk
from django.db.models.query_utils import Q
from django.utils import timezone

from sentry import features
from sentry.models.files import FileBlob, FileBlobOwner
from sentry.models.organization import Organization


def find_missing_chunks(organization: Organization, chunks: Sequence[str]):
    """Returns a list of chunks which are missing for an org."""
    if features.has("organizations:find-missing-chunks-new", organization):
        return _find_missing_chunks_new(organization.id, chunks)

    return _find_missing_chunks_old(organization.id, chunks)


def _find_missing_chunks_new(organization_id: int, chunks: Sequence[str]):
    with sentry_sdk.start_span(op="find_missing_chunks_new") as span:
        span.set_tag("organization_id", organization_id)
        span.set_data("chunks_size", len(chunks))
        # We get all the file blobs given the chunks. If a file blob is already tied to an organization, the organization id
        # will be returned.
        file_blobs = (
            FileBlob.objects.filter(checksum__in=chunks)
            .select_related("fileblobowner")  # Optimize the join with the related model
            .filter(
                Q(fileblobowner__organization_id=organization_id) | Q(fileblobowner__isnull=True)
            )
            .values_list(
                "id",
                "checksum",
                "timestamp",
                "fileblobowner__organization_id",
                flat=False,  # Set to True if you want a flat list instead of tuples
            )
        )

        now = timezone.now()
        oldest_timestamp = now - timedelta(hours=12)

        # For each file blob we compute whether we should renew it and whether it has already an organization bound to it.
        file_blobs_to_renew = set()
        chunks_with_organization_id = set()
        for id, checksum, timestamp, organization_id in file_blobs:
            if timestamp <= oldest_timestamp:
                file_blobs_to_renew.add(id)

            if organization_id is not None:
                chunks_with_organization_id.add(checksum)

        if file_blobs_to_renew:
            # We update the timestamp of the file blobs that need renewal.
            FileBlob.objects.filter(id__in=file_blobs_to_renew).update(timestamp=now)

        return list(set(chunks) - chunks_with_organization_id)


def _find_missing_chunks_old(organization_id: int, chunks: Sequence[str]):
    with sentry_sdk.start_span(op="find_missing_chunks_old") as span:
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
