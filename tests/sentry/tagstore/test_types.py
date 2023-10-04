from __future__ import annotations

import pickle

import pytest

from sentry.tagstore.types import GroupTagKey, GroupTagValue, TagKey, TagValue

classes = pytest.mark.parametrize("cls", (TagKey, TagValue, GroupTagKey, GroupTagValue))


@classes
def test_pickle(cls):
    value = cls(**{name: 1 for name in cls.__slots__})
    assert pickle.loads(pickle.dumps(value)) == value


@classes
def test_sorting(cls):
    value1 = cls(**{name: 1 for name in cls.__slots__})
    value2 = cls(**{name: 2 for name in cls.__slots__})

    assert value1 < value2
