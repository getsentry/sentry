import dataclasses
from datetime import datetime
from typing import Dict, FrozenSet, Generic, List, Mapping, MutableMapping, Optional, Set, TypeVar

import openapi_schema_validator
from django.utils import timezone

from sentry.services.hybrid_cloud.rpc.serialization import get_serializer_from_annotation
from sentry.utils import json


def test_serialization_errors():
    pass


def _test_serializer(t: object, example: object):
    serializer = get_serializer_from_annotation(t)
    parsed = json.loads(json.dumps(serializer.to_json(example)))
    openapi_schema_validator.validate(parsed, serializer.schema_type())
    loaded = serializer.from_json(parsed)
    assert loaded == example

    serializer = get_serializer_from_annotation(Optional[t])
    parsed = json.loads(json.dumps(serializer.to_json(None)))
    openapi_schema_validator.validate(parsed, serializer.schema_type())
    loaded = serializer.from_json(parsed)
    assert loaded is None


A = TypeVar("A")
B = TypeVar("B")


@dataclasses.dataclass
class TestDataClass(Generic[A, B]):
    a: Optional[A] = None
    b: Optional[B] = None
    c: int = -1


def test_serializations():
    for t, example in [
        (int, 1000),
        (int, -11),
        (float, -0),
        (float, 1),
        (float, 102.3),
        (str, ""),
        (str, "absdf"),
        (bool, False),
        (object, dict(a=2, b=[1, 2, 3])),
        (datetime, timezone.now()),
        (TestDataClass[str, List[int]], TestDataClass(a="", b=[1], c=4)),
    ]:
        _test_serializer(t, example)
        _test_serializer(List[t], [example, example])
        if not isinstance(example, dict) and not isinstance(example, TestDataClass):
            _test_serializer(Set[t], {example})
            _test_serializer(FrozenSet[t], frozenset([example]))
        _test_serializer(Mapping[str, t], {"a": example, "b": example})
        _test_serializer(Dict[str, t], {"a": example, "b": example})
        _test_serializer(MutableMapping[str, t], {"a": example, "b": example})
