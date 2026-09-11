from __future__ import annotations

from typing import TypedDict

import pytest

from sentry.api.serializers import Serializer
from sentry.api.serializers.shaping import (
    ResponseShaping,
    UndeclaredShapingKey,
    all_response_shapings,
    get_response_shaping,
    response_type_of,
    shaping_for_response_type,
)


class _WidgetResponse(TypedDict, total=False):
    id: str
    stats: dict[str, int]
    owners: list[str]


class _WidgetSerializer(Serializer[_WidgetResponse]):
    shaping = ResponseShaping(
        expand={"owners": ("owners",)},
        collapse={"stats": ("stats",)},
    )

    def __init__(self, expand: list[str] | None = None, collapse: list[str] | None = None):
        self.expand = expand
        self.collapse = collapse


class _DetailedWidgetSerializer(_WidgetSerializer):
    shaping = _WidgetSerializer.shaping.extend(expand={"history": ("history",)})


class _UnshapedSerializer(Serializer[_WidgetResponse]):
    def __init__(self) -> None:
        self.expand = ["owners"]


def test_declared_key_reflects_request() -> None:
    assert _WidgetSerializer(expand=["owners"])._expand("owners")
    assert not _WidgetSerializer(expand=["stats"])._expand("owners")
    assert _WidgetSerializer(collapse=["stats"])._collapse("stats")


def test_none_means_nothing_requested() -> None:
    serializer = _WidgetSerializer()
    assert not serializer._expand("owners")
    assert not serializer._collapse("stats")


def test_undeclared_key_raises_in_tests() -> None:
    with pytest.raises(UndeclaredShapingKey):
        _WidgetSerializer(expand=["typo"])._expand("typo")
    # A key declared for the other kind is still undeclared for this one.
    with pytest.raises(UndeclaredShapingKey):
        _WidgetSerializer(collapse=["owners"])._collapse("owners")
    with pytest.raises(UndeclaredShapingKey):
        _UnshapedSerializer()._expand("owners")


def test_extend_keeps_base_keys() -> None:
    shaping = get_response_shaping(_DetailedWidgetSerializer)
    assert shaping is not None
    assert shaping.expand_keys == ("history", "owners")
    assert shaping.collapse_keys == ("stats",)
    assert _DetailedWidgetSerializer(expand=["history"])._expand("history")


def test_merge_unions_fields() -> None:
    merged = ResponseShaping(expand={"a": ("x",)}).merge(
        ResponseShaping(expand={"a": ("y",), "b": ("z",)}, collapse={"c": ("w",)})
    )
    assert merged.expand == {"a": ("x", "y"), "b": ("z",)}
    assert merged.collapse == {"c": ("w",)}
    assert merged.as_dict() == {"expand": {"a": ["x", "y"], "b": ["z"]}, "collapse": {"c": ["w"]}}


def test_response_type_resolution() -> None:
    assert response_type_of(_WidgetSerializer) is _WidgetResponse
    shaping = shaping_for_response_type(list[_WidgetResponse])
    assert shaping is not None
    # Both widget serializers produce the same TypedDict; their keys combine.
    assert shaping.expand_keys == ("history", "owners")


def _load_shaped_serializers() -> None:
    # Import every module that declares a shaping so the registry walk sees it.
    import sentry.api.serializers.models.group_stream  # noqa: F401
    import sentry.api.serializers.models.organization_member.base  # noqa: F401
    import sentry.api.serializers.models.organization_member.scim  # noqa: F401
    import sentry.api.serializers.models.project  # noqa: F401
    import sentry.api.serializers.models.projectcodeowners  # noqa: F401
    import sentry.api.serializers.models.repository  # noqa: F401
    import sentry.api.serializers.models.rule  # noqa: F401
    import sentry.api.serializers.models.team  # noqa: F401
    import sentry.incidents.endpoints.serializers.workflow_engine_detector  # noqa: F401
    import sentry.incidents.endpoints.serializers.workflow_engine_incident  # noqa: F401
    import sentry.monitors.serializers  # noqa: F401


def _response_fields(serializer_cls: type) -> set[str] | None:
    """
    The response keys a serializer and its subclasses declare. A base serializer
    may gather a field (``options`` on projects) that only a subclass emits.
    """
    fields: set[str] = set()
    found = False
    stack = [serializer_cls]
    while stack:
        cls = stack.pop()
        response_type = response_type_of(cls)
        if response_type is not None:
            found = True
            fields.update(response_type.__annotations__)
        stack.extend(cls.__subclasses__())
    return fields if found else None


def test_every_mapped_field_exists_on_the_response_type() -> None:
    _load_shaped_serializers()
    shapings = all_response_shapings()
    assert len(shapings) >= 11, sorted(cls.__name__ for cls in shapings)

    unverifiable: list[str] = []
    for serializer_cls, shaping in shapings.items():
        if serializer_cls.__module__.startswith("tests."):
            continue
        if "shaping" not in vars(serializer_cls):
            # Inherited: the declaring base is checked, and a subclass that
            # narrows the response (SharedGroupSerializer) still runs the base's
            # get_attrs, so it must keep the base keys declared.
            continue
        fields = _response_fields(serializer_cls)
        if fields is None:
            unverifiable.append(serializer_cls.__name__)
            continue
        missing = shaping.fields() - fields
        assert not missing, f"{serializer_cls.__name__} maps to unknown fields {sorted(missing)}"

    # Serializers whose response shape is not a resolvable TypedDict cannot be
    # checked: ProjectCodeOwnersSerializer has no return annotation, and the
    # detector serializer's annotation is a TYPE_CHECKING-only import. Shrink
    # this list by typing (or importing) their `serialize` return value.
    assert sorted(unverifiable) == [
        "ProjectCodeOwnersSerializer",
        "WorkflowEngineDetectorSerializer",
    ]


def test_openapi_parameter_enums_match_the_serializers() -> None:
    from sentry.api.serializers.models.group_stream import GROUP_STREAM_SHAPING
    from sentry.api.serializers.models.team import TEAM_SHAPING
    from sentry.apidocs.parameters import IssueParams, TeamParams

    assert IssueParams.GROUP_INDEX_EXPAND.enum == list(GROUP_STREAM_SHAPING.expand_keys)
    assert IssueParams.GROUP_INDEX_COLLAPSE.enum == list(GROUP_STREAM_SHAPING.collapse_keys)
    assert TeamParams.EXPAND.enum == list(TEAM_SHAPING.expand_keys)


def test_group_stream_keys_cover_the_stream_response() -> None:
    from sentry.api.serializers.models.group_stream import (
        GROUP_STREAM_SHAPING,
        StreamGroupSerializerSnubaResponse,
    )

    response_fields: set[str] = set(StreamGroupSerializerSnubaResponse.__annotations__)
    assert GROUP_STREAM_SHAPING.fields() <= response_fields
    assert "base" in GROUP_STREAM_SHAPING.collapse
    assert set(GROUP_STREAM_SHAPING.collapse["base"]) >= {"id", "title", "culprit"}
