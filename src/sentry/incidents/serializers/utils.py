from collections.abc import Sequence
from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers

from sentry.api.utils import to_valid_int_id_list


def validate_object_ids_belong(
    name: str,
    raw_ids: Sequence[str | int],
    queryset: QuerySet[Any],
    error_message: str,
) -> list[int]:
    """
    Validate that all supplied ids are valid integers and belong to the given
    (parent-scoped) queryset. Returns the validated ints. Raises a
    serializers.ValidationError (-> HTTP 400) listing any ids that don't belong.
    """
    ids = to_valid_int_id_list(name, raw_ids)
    if ids:
        existing = set(queryset.filter(id__in=ids).values_list("id", flat=True))
        missing = [i for i in ids if i not in existing]
        if missing:
            raise serializers.ValidationError(f"{error_message}: {missing}")
    return ids
