from datetime import timedelta
from typing import Sequence

from django.utils import timezone

from sentry.models.files import FileBlob, FileBlobOwner


def find_missing_chunks(organization_id: int, chunks: Sequence[str]):
    """Returns a list of chunks which are missing for an org."""
    # refresh the timestamp of all files we are interested in,
    # so they don't disappear from under us
    now = timezone.now()
    threshold = now - timedelta(hours=12)
    FileBlob.objects.filter(checksum__in=chunks, timestamp__lte=threshold).update(timestamp=now)

    owned = set(
        FileBlobOwner.objects.filter(
            blob__checksum__in=chunks, organization_id=organization_id
        ).values_list("blob__checksum", flat=True)
    )
    return list(set(chunks) - owned)
