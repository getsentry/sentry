from __future__ import annotations

import functools
from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, Any, ClassVar, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.search.utils import convert_user_tag_to_query
from sentry.tagstore.base import TagKeyStatus


@functools.total_ordering
class TagType:
    _sort_key: ClassVar[str]
    __slots__: tuple[str, ...] = ()

    def __repr__(self) -> str:
        return "<{}: {}>".format(
            type(self).__name__,
            ", ".join(f"{name}={getattr(self, name)!r}" for name in self.__slots__),
        )

    def __hash__(self) -> int:
        return hash(tuple(getattr(self, name) for name in self.__slots__))

    def __eq__(self, other: object) -> bool:
        return type(self) is type(other) and all(
            getattr(self, name) == getattr(other, name) for name in self.__slots__
        )

    def __lt__(self, other: object) -> bool:
        self_val = getattr(self, self._sort_key)
        other_val = getattr(other, self._sort_key)
        # Handle None values in sorting - None sorts before any non-None value
        if self_val is None and other_val is None:
            return False
        if self_val is None:
            return True
        if other_val is None:
            return False
        return self_val < other_val

    def __getstate__(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.__slots__}

    def __setstate__(self, state: dict[str, Any]) -> None:
        for name, value in state.items():
            setattr(self, name, value)


class TagKey(TagType):
    __slots__ = ("key", "values_seen", "status", "count", "top_values")
    _sort_key = "values_seen"

    def __init__(
        self,
        key: str,
        values_seen: int | None = None,
        status: int = TagKeyStatus.ACTIVE,
        count: int | None = None,
        top_values: tuple[TagValue, ...] | None = None,
    ):
        self.key = key
        self.values_seen = values_seen
        self.status = status
        self.count = count
        self.top_values = top_values

    def get_audit_log_data(self) -> dict[str, str]:
        return {"key": self.key}


class TagValue(TagType):
    __slots__ = ("key", "value", "times_seen", "first_seen", "last_seen")
    _sort_key = "value"

    def __init__(
        self,
        key: str,
        value: str | None,
        times_seen: int | None,
        first_seen: datetime | None,
        last_seen: datetime | None,
    ):
        self.key = key
        self.value = value
        self.times_seen = times_seen
        self.first_seen = first_seen
        self.last_seen = last_seen


class GroupTagKey(TagType):
    __slots__ = ("group_id", "key", "values_seen", "count", "top_values")
    _sort_key = "values_seen"

    def __init__(
        self,
        group_id: int,
        key: str,
        values_seen: int | None = None,
        count: int | None = None,
        top_values: tuple[GroupTagValue, ...] | None = None,
    ):
        self.group_id = group_id
        self.key = key
        self.values_seen = values_seen
        self.count = count
        self.top_values = top_values


class GroupTagValue(TagType):
    __slots__ = ("group_id", "key", "value", "times_seen", "first_seen", "last_seen")
    _sort_key = "value"

    def __init__(
        self,
        group_id: int,
        key: str,
        value: str | None,
        times_seen: int,
        first_seen: datetime | None,
        last_seen: datetime | None,
    ):
        self.group_id = group_id
        self.key = key
        self.value = value
        self.times_seen = times_seen
        self.first_seen = first_seen
        self.last_seen = last_seen


class TagKeySerializerResponseOptional(TypedDict, total=False):
    uniqueValues: Annotated[
        int | None, ApiDescription("Number of distinct values seen for the tag key")
    ]
    totalValues: Annotated[
        int | None,
        ApiDescription(
            "Number of events counted for the tag key. For an issue tag, this is the issue's "
            "retained event count, including events without the tag"
        ),
    ]
    topValues: Annotated[
        list[TagValueSerializerResponse] | None,
        ApiDescription("Most frequent values of the tag key, ordered by count"),
    ]


class TagKeySerializerResponse(TagKeySerializerResponseOptional):
    key: Annotated[
        str, ApiDescription("Tag key, with the `sentry:` prefix removed from built-in keys")
    ]
    name: Annotated[str, ApiDescription("Display label of the tag key")]


@register(GroupTagKey)
@register(TagKey)
class TagKeySerializer(Serializer[TagKeySerializerResponse]):
    def serialize(
        self,
        obj: TagKey | GroupTagKey,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> TagKeySerializerResponse:
        from sentry import tagstore

        output: TagKeySerializerResponse = {
            "key": tagstore.backend.get_standardized_key(obj.key),
            "name": tagstore.backend.get_tag_key_label(obj.key),
        }
        if obj.values_seen is not None:
            output["uniqueValues"] = obj.values_seen
        if obj.count is not None:
            output["totalValues"] = obj.count
        if obj.top_values is not None:
            output["topValues"] = serialize(obj.top_values, user)
        return output


class TagValueSerializerResponseOptional(TypedDict, total=False):
    query: Annotated[
        str | None,
        ApiDescription(
            "Search query that matches events with the tag value. Only set for the user tag"
        ),
    ]


class TagValueSerializerResponse(TagValueSerializerResponseOptional):
    key: Annotated[
        str, ApiDescription("Tag key, with the `sentry:` prefix removed from built-in keys")
    ]
    name: Annotated[
        str | None,
        ApiDescription(
            "Display label of the tag value. For the user tag, the `id:`, `email:`, `username:` or `ip:` prefix is removed"
        ),
    ]
    value: Annotated[str | None, ApiDescription("Tag value")]
    # Empty values do not have counts, last seen or first seen timestamps.
    count: Annotated[
        int | None, ApiDescription("Number of events with the tag value. Null for an empty value")
    ]
    lastSeen: Annotated[
        datetime | None,
        ApiDescription("When the tag value was last seen (ISO 8601). Null for an empty value"),
    ]
    firstSeen: Annotated[
        datetime | None,
        ApiDescription("When the tag value was first seen (ISO 8601). Null for an empty value"),
    ]


@register(GroupTagValue)
@register(TagValue)
class TagValueSerializer(Serializer[TagValueSerializerResponse]):
    def serialize(
        self,
        obj: TagValue | GroupTagValue,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> TagValueSerializerResponse:
        from sentry import tagstore

        key = tagstore.backend.get_standardized_key(obj.key)
        serialized: TagValueSerializerResponse = {
            "key": key,
            "name": tagstore.backend.get_tag_value_label(obj.key, obj.value),
            "value": obj.value,
            "count": obj.times_seen,
            "lastSeen": obj.last_seen,
            "firstSeen": obj.first_seen,
        }

        query = convert_user_tag_to_query(key, obj.value) if obj.value is not None else None
        if query:
            serialized["query"] = query

        return serialized
