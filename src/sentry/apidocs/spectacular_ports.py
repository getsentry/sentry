# type: ignore

import collections
import inspect
import typing
from collections import OrderedDict, defaultdict
from enum import Enum
from typing import Any, Literal, Union
from typing import get_type_hints as _get_type_hints

from drf_spectacular.drainage import get_override
from drf_spectacular.plumbing import (
    UnableToProceedError,
    build_array_type,
    build_basic_type,
    build_object_type,
    is_basic_type,
)
from drf_spectacular.types import OpenApiTypes
from typing_extensions import _TypedDictMeta

from sentry.apidocs.utils import reload_module_with_type_checking_enabled

# Until we're on 3.9 we have to use the typing extention TypedDict as
# we are unable to tell optional fields at run time via the regular 3.8
# implementation


# This function is ported from the drf-spectacular library method here:
# https://github.com/tfranzel/drf-spectacular/blob/03d315ced245db71cef1e45fd05a082b7dedc7aa/drf_spectacular/plumbing.py#L1100
# with modifications to support our use case:
#   grabbing description from a TypedDict __doc__
#   support for TypedDict required fields
#   support for excluded fields via @extend_schema_serializer
#   warning about using typing_extension TypedDict

# TODO:
#   figure out solution for field descriptions
#   support deprecated fields via extension
#   map TypedDicts in schema registry


def get_type_hints(hint, **kwargs):
    try:
        return _get_type_hints(hint, **kwargs)
    except NameError:
        # try to resolve a circular import from TYPE_CHECKING imports
        reload_module_with_type_checking_enabled(hint.__module__)
        return _get_type_hints(hint, **kwargs)


def _get_type_hint_origin(hint):
    return typing.get_origin(hint), typing.get_args(hint)


def resolve_type_hint(hint) -> Any:
    """drf-spectacular library method modified as described above"""
    origin, args = _get_type_hint_origin(hint)
    excluded_fields = get_override(hint, "exclude_fields", [])

    if origin is None and is_basic_type(hint, allow_none=False):
        return build_basic_type(hint)
    elif origin is None and inspect.isclass(hint) and issubclass(hint, tuple):
        # a convoluted way to catch NamedTuple. suggestions welcome.
        if get_type_hints(hint):
            properties = {k: resolve_type_hint(v) for k, v in get_type_hints(hint).items()}
        else:
            properties = {k: build_basic_type(OpenApiTypes.ANY) for k in hint._fields}
        return build_object_type(properties=properties, required=properties.keys())
    elif origin is list or hint is list:
        return build_array_type(
            resolve_type_hint(args[0]) if args else build_basic_type(OpenApiTypes.ANY)
        )
    elif origin is tuple:
        return build_array_type(
            schema=build_basic_type(args[0]),
            max_length=len(args),
            min_length=len(args),
        )
    elif origin is dict or origin is defaultdict or origin is OrderedDict:
        schema = build_basic_type(OpenApiTypes.OBJECT)
        if args and args[1] is not typing.Any:
            schema["additionalProperties"] = resolve_type_hint(args[1])
        return schema
    elif origin is set:
        return build_array_type(resolve_type_hint(args[0]))
    elif origin is frozenset:
        return build_array_type(resolve_type_hint(args[0]))
    elif origin is Literal:
        # Literal only works for python >= 3.8 despite typing_extensions, because it
        # behaves slightly different w.r.t. __origin__
        schema = {"enum": list(args)}
        if all(type(args[0]) is type(choice) for choice in args):
            schema.update(build_basic_type(type(args[0])))
        return schema
    elif inspect.isclass(hint) and issubclass(hint, Enum):
        schema = {"enum": [item.value for item in hint]}
        mixin_base_types = [t for t in hint.__mro__ if is_basic_type(t)]
        if mixin_base_types:
            schema.update(build_basic_type(mixin_base_types[0]))
        return schema
    elif isinstance(hint, _TypedDictMeta):
        return build_object_type(
            properties={
                k: resolve_type_hint(v)
                for k, v in get_type_hints(hint).items()
                if k not in excluded_fields
            },
            description=inspect.cleandoc(hint.__doc__ or ""),
            required=[h for h in hint.__required_keys__ if h not in excluded_fields],
        )
    elif origin is Union:
        type_args = [arg for arg in args if arg is not type(None)]  # noqa: E721
        if len(type_args) > 1:
            schema = {"oneOf": [resolve_type_hint(arg) for arg in type_args]}
        else:
            schema = resolve_type_hint(type_args[0])
        if type(None) in args:
            schema["nullable"] = True
        return schema
    elif origin is collections.abc.Iterable:
        return build_array_type(resolve_type_hint(args[0]))
    elif isinstance(hint, typing._TypedDictMeta):
        raise UnableToProceedError("Wrong TypedDict class, please use typing_extensions.TypedDict")
    else:
        raise UnableToProceedError()
