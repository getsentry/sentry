from __future__ import annotations

import abc
import collections.abc
import dataclasses
import datetime
from inspect import FullArgSpec, getfullargspec
from typing import (
    Any,
    Callable,
    Iterable,
    Mapping,
    MutableMapping,
    Sequence,
    TypeVar,
    Union,
    get_args,
    get_origin,
)

from django.utils.dateparse import parse_datetime

from sentry.services.hybrid_cloud import Unset

_T = TypeVar("_T")


class JsonSerializer(abc.ABC):
    @abc.abstractmethod
    def schema_type(self) -> Mapping[str, Any]:
        pass

    @abc.abstractmethod
    def to_json(self, value: Any) -> Any:
        pass

    @abc.abstractmethod
    def from_json(self, value: Any) -> Any:
        pass


class ScalarSerializer(JsonSerializer):
    t: Any
    inner: Callable[[Any], Any]
    outer: Callable[[Any], Any]

    def __init__(self, t: Any, outer: Callable[[Any], Any], inner: Callable[[Any], Any]):
        self.t = t
        self.outer = outer
        self.inner = inner

    def schema_type(self) -> Mapping[str, Any]:
        return self.t

    def to_json(self, value: Any) -> Any:
        return self.inner(value)

    def from_json(self, value: Any) -> Any:
        return self.outer(value)


class ListSerializer(JsonSerializer):
    inner: JsonSerializer
    outer: Callable[[Iterable[Any]], Any]

    def __init__(self, outer: Callable[[Iterable[Any]], Any], inner: JsonSerializer):
        self.outer = outer
        self.inner = inner

    def schema_type(self) -> Mapping[str, Any]:
        return dict(type="array", items=self.inner.schema_type())

    def to_json(self, value: Any) -> Any:
        return [self.inner.to_json(i) for i in value]

    def from_json(self, value: Any) -> Any:
        return self.outer(self.inner.from_json(i) for i in value)


class DataClassSerializer(JsonSerializer):
    fields: Mapping[str, JsonSerializer]
    constructor: Any

    def __init__(self, fields: Mapping[str, JsonSerializer], constructor: Any):
        self.fields = fields
        self.constructor = constructor

    def schema_type(self) -> Mapping[str, Any]:
        return dict(type="object", properties={k: v.schema_type() for k, v in self.fields.items()})

    def to_json(self, value: Any) -> Any:
        result: Any = getattr(value, "__extra_fields__", None) or {}
        for k, s in self.fields.items():
            v = getattr(value, k)
            if v is Unset:
                continue
            result[k] = s.to_json(v)
        return result

    def from_json(self, value: Any) -> Any:
        kwds: MutableMapping[str, Any] = {}
        extra_fields: MutableMapping[str, Any] = {}
        for k, v in value.items():
            if k in self.fields:
                kwds[k] = self.fields[k].from_json(v)
            else:
                extra_fields[k] = v
        result = self.constructor(**kwds)
        setattr(result, "__extra_fields__", extra_fields)
        return result


@dataclasses.dataclass
class Entry:
    k: str
    v: object


class EntrySerializer(DataClassSerializer):
    inner: JsonSerializer

    def __init__(self, inner: JsonSerializer):
        self.inner = inner
        super().__init__({"k": str_serializer, "v": inner}, Entry)

    def schema_type(self) -> Mapping[str, Any]:
        return dict(
            type="object",
            properties=dict(
                k=str_serializer.schema_type(),
                v=self.inner.schema_type(),
            ),
            required=["k", "v"],
        )


class NullableSerializer(JsonSerializer):
    inner: JsonSerializer

    def __init__(self, inner: JsonSerializer):
        self.inner = inner

    def schema_type(self) -> Mapping[str, Any]:
        return dict(nullable=True, **self.inner.schema_type())

    def to_json(self, value: Any) -> Any:
        if value is None:
            return None
        return self.inner.to_json(value)

    def from_json(self, value: Any) -> Any:
        if value is None:
            return None
        return self.inner.from_json(value)


class MapSerializer(ListSerializer):
    def __init__(self, inner: JsonSerializer):
        super().__init__(lambda values: {e.k: e.v for e in values}, EntrySerializer(inner))

    def to_json(self, value: Any) -> Any:
        return super().to_json(Entry(k=k, v=v) for k, v in value.items())


_id = lambda i: i

int_serializer = ScalarSerializer(dict(type="integer", format="int64"), _id, _id)
str_serializer = ScalarSerializer(dict(type="string"), _id, _id)
float_serializer = ScalarSerializer(dict(type="number"), _id, _id)
bool_serializer = ScalarSerializer(dict(type="boolean"), _id, _id)
opaque_serializer = ScalarSerializer(dict(type="object"), _id, _id)
datetime_serializer = ScalarSerializer(
    dict(type="string", format="date-time"),
    lambda s: parse_datetime(s),
    lambda o: o.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
)


class TypeSerializationError(TypeError):
    def __init__(self, parent: object, t: object, message: str):
        if t is parent:
            t_msg = ""
        else:
            t_msg = f"{t} "
        super().__init__(f"{parent} is not serializable: {t_msg}{message}")


def _from_entries() -> Any:
    pass


def get_serializer_from_args(f: Callable[..., Any]) -> JsonSerializer:
    argspec: FullArgSpec = getfullargspec(f)
    try:
        assert len(argspec.args) == 2
        assert not argspec.kwonlyargs
        assert argspec.args[0] == "self"
        assert argspec.args[1] in argspec.annotations
    except AssertionError:
        raise TypeSerializationError(
            f,
            f,
            "RPC service methods must have exactly only non self argument, which must be annotated",
        )

    return get_serializer_from_annotation(argspec.annotations[argspec.args[1]])


# This, alternative, attempts to create a serializer from a full argspec.  It works but it has some problems:
# 1. Error messages are kinda, not great.  It's hard to report on issues with function arguments as opposed to issues with dataclasses.
# 2. It doesn't, yet, handle the case where we receive "extra fields" as a result of version drift.  We need to not return a dict
# that would compromise a callsite of an older version unaware of a new keyword.
# 3. It makes the routes_by_org_id family of functions more tricky to implement correctly.
# def get_serializer_from_args(f: function) -> JsonSerializer:
#     if f in serializers_cache:
#         return serializers_cache[f]
#
#     argspec: FullArgSpec = getfullargspec(f)
#     try:
#         assert argspec.args == ['self']
#         assert not argspec.defaults
#     except AssertionError:
#         raise RpcSerializationError(None, argspec, "has positional args other than 'self'.  All RPC calls must be kwds only (ie method(self, *, arg1=1, arg2=2))")
#     fields: MutableMapping[str, JsonSerializer] = {}
#     for argname in argspec.kwonlyargs:
#         if not argspec.kwonlydefaults or argname not in argspec.kwonlydefaults:
#             raise RpcSerializationError(None, argspec, f"has argument {repr(argname)} without a default.  Please provide a default.")
#         if not argspec.annotations or argname not in argspec.annotations:
#             raise RpcSerializationError(None, argspec, f"has argument {repr(argname)} without a type annotation.  Please provide one.")
#         fields[argname] = get_serializer(argspec.annotations[argname], None)
#
#     result = StructSerializer(fields, lambda keys: keys)
#     serializers_cache[f] = result
#     return result


def get_serializer_from_annotation(
    t: object, parent: object | None = None, parameters: MutableMapping[Any, Any] | None = None
) -> JsonSerializer:
    if parent is None:
        parent = t
    if t is type(None):  # noqa
        raise TypeSerializationError(parent, t, "fields cannot be serialized")
    if t is int:
        return int_serializer
    if t is str:
        return str_serializer
    if t is float:
        return float_serializer
    if t is bool:
        return bool_serializer
    if t is object:
        return opaque_serializer
    if t is datetime.datetime:
        return datetime_serializer

    origin = get_origin(t)
    args: Sequence[object] = get_args(t)

    if parameters is None:
        parameters = {}

    for i, p in enumerate(getattr(origin, "__parameters__", [])):
        if i > len(args):
            break
        parameters[p] = args[i]

    def resolve_inner_type(t: object) -> object:
        try:
            return parameters[t]
        except KeyError:
            return t

    if origin is Union:
        if len(args) == 2 and type(None) in args:
            for arg in args:
                if arg is type(None):  # noqa
                    continue
                inner = get_serializer_from_annotation(resolve_inner_type(arg), parent, parameters)
                return NullableSerializer(inner)
        else:
            raise TypeSerializationError(parent, t, "is not supported, only Optional")

    if origin is frozenset:
        if len(args) != 1:
            raise TypeSerializationError(parent, t, "is not supported without type parameters")
        inner = get_serializer_from_annotation(resolve_inner_type(args[0]), parent, parameters)
        return ListSerializer(frozenset, inner)
    if origin is list:
        if len(args) != 1:
            raise TypeSerializationError(parent, t, "is not supported without type parameters")
        inner = get_serializer_from_annotation(resolve_inner_type(args[0]), parent, parameters)
        return ListSerializer(list, inner)
    if origin is set:
        if len(args) != 1:
            raise TypeSerializationError(parent, t, "is not supported without type parameters")
        inner = get_serializer_from_annotation(resolve_inner_type(args[0]), parent, parameters)
        return ListSerializer(set, inner)
    if (
        origin is dict
        or origin is collections.abc.Mapping
        or origin is collections.abc.MutableMapping
    ):
        if len(args) != 2:
            raise TypeSerializationError(parent, t, "is not supported without type parameters")
        if args[0] != str:
            raise TypeSerializationError(parent, t, "keys are not supported, only strings allowed")
        return MapSerializer(
            get_serializer_from_annotation(resolve_inner_type(args[1]), parent, parameters)
        )
    if dataclasses.is_dataclass(origin):
        fields: MutableMapping[str, JsonSerializer] = {}
        field: dataclasses.Field
        for field in dataclasses.fields(origin):
            if field.default is dataclasses.MISSING:
                raise TypeSerializationError(
                    parent,
                    t,
                    f"has field {repr(field.name)} without a default.  Please provide a default or default_factory",
                )

            fields[field.name] = get_serializer_from_annotation(
                resolve_inner_type(field.type), parent, parameters
            )
        return DataClassSerializer(fields, origin)

    if isinstance(t, str):
        raise TypeSerializationError(
            parent, t, "is a forward ref string, try replacing it with a concrete type."
        )

    raise TypeSerializationError(
        parent,
        t,
        "is not supported for rpc serialization. See sentry.services.hybrid_cloud.rpc.serialization for supported types",
    )
