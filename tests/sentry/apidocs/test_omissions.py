from __future__ import annotations

import pytest
from drf_spectacular.drainage import get_override
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.apidocs.omissions import OMISSION_REASONS_OVERRIDE, sentry_schema_serializer


@sentry_schema_serializer(
    omit_from_public_schema={"internalOnly": "Untyped escape hatch; not public surface."}
)
class OmittingSerializer(serializers.Serializer):
    documented = serializers.CharField(help_text="A documented field.", required=False)
    internalOnly = serializers.DictField(required=False)


def test_omitted_field_lands_in_the_override_drf_spectacular_reads() -> None:
    # openapi.py filters serializer properties on this exact override.
    assert get_override(OmittingSerializer, "exclude_fields") == ["internalOnly"]


def test_documented_field_is_not_omitted() -> None:
    assert "documented" not in get_override(OmittingSerializer, "exclude_fields", [])


def test_reasons_are_recorded() -> None:
    reasons = get_override(OmittingSerializer, OMISSION_REASONS_OVERRIDE)
    assert reasons == {"internalOnly": "Untyped escape hatch; not public surface."}


def test_legacy_exclude_fields_still_honored() -> None:
    @extend_schema_serializer(exclude_fields=["legacy"])
    class LegacySerializer(serializers.Serializer):
        legacy = serializers.CharField(required=False)

    assert get_override(LegacySerializer, "exclude_fields") == ["legacy"]
    assert get_override(LegacySerializer, OMISSION_REASONS_OVERRIDE) is None


def test_stacked_decorators_merge_rather_than_clobber() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"new": "A stated reason."})
    @extend_schema_serializer(exclude_fields=["legacy"])
    class StackedSerializer(serializers.Serializer):
        legacy = serializers.CharField(required=False)
        new = serializers.CharField(required=False)

    assert sorted(get_override(StackedSerializer, "exclude_fields")) == ["legacy", "new"]


def test_subclass_inherits_without_mutating_parent() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"childOnly": "A stated reason."})
    class Child(OmittingSerializer):
        childOnly = serializers.CharField(required=False)

    assert sorted(get_override(Child, "exclude_fields")) == ["childOnly", "internalOnly"]
    assert get_override(OmittingSerializer, "exclude_fields") == ["internalOnly"]


@pytest.mark.parametrize("reason", ["", "   ", "\n"])
def test_blank_reason_is_rejected(reason: str) -> None:
    with pytest.raises(ValueError) as excinfo:
        sentry_schema_serializer(omit_from_public_schema={"field": reason})
    assert "field" in str(excinfo.value)
    assert "help_text" in str(excinfo.value)


def test_empty_mapping_is_rejected() -> None:
    with pytest.raises(ValueError):
        sentry_schema_serializer(omit_from_public_schema={})
