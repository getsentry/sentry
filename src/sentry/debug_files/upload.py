from datetime import timedelta

import sentry_sdk
from django.utils import timezone

from sentry.models.files import FileBlob


def find_missing_chunks(organization_id: int, chunks: set[str]):
    """Returns a list of chunks which are missing for an org."""
    with sentry_sdk.start_span(op="find_missing_chunks") as span:
        span.set_tag("organization_id", organization_id)
        span.set_attribute("chunks_size", len(chunks))

        if not chunks:
            return []

        with sentry_sdk.start_span(op="find_missing_chunks.fetch_owned_file_blobs"):
            owned_file_blobs = FileBlob.objects.filter(
                checksum__in=chunks, fileblobowner__organization_id=organization_id
            ).values_list(
                "id",
                "checksum",
                "timestamp",
                flat=False,
            )

        # We compute the chunks that we know are owned and the ones that are not owned, but we still want to check.
        owned_file_chunks = {checksum for _, checksum, _ in owned_file_blobs}
        unowned_file_chunks = chunks - owned_file_chunks

        with sentry_sdk.start_span(op="find_missing_chunks.fetch_unowned_file_blobs"):
            unowned_file_blobs = FileBlob.objects.filter(
                checksum__in=unowned_file_chunks,
            ).values_list(
                "id",
                "checksum",
                "timestamp",
                flat=False,
            )

        now = timezone.now()
        oldest_timestamp = now - timedelta(hours=12)

        # For each file blob we compute whether we should renew it and whether it has already an organization bound to it.
        file_blobs_to_renew = set()
        for id, checksum, timestamp in list(owned_file_blobs) + list(unowned_file_blobs):
            if timestamp <= oldest_timestamp:
                file_blobs_to_renew.add(id)

        if file_blobs_to_renew:
            with sentry_sdk.start_span(op="find_missing_chunks_new.update_timestamp"):
                # We update the timestamp of the file blobs that need renewal.
                FileBlob.objects.filter(id__in=file_blobs_to_renew).update(timestamp=now)

        # We return all the file chunks that are not bound to the supply organization.
        return list(unowned_file_chunks)
