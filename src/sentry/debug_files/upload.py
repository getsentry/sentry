from typing import Sequence

from sentry.models.files.fileblobowner import FileBlobOwner


def find_missing_chunks(organization_id: int, chunks: Sequence[str]):
    """Returns a list of chunks which are missing for an org."""
    owned = set(
        FileBlobOwner.objects.filter(
            blob__checksum__in=chunks, organization_id=organization_id
        ).values_list("blob__checksum", flat=True)
    )
    return list(set(chunks) - owned)
