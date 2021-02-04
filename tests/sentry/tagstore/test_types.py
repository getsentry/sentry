import pickle
from sentry.tagstore.types import TagKey, TagValue, GroupTagKey, GroupTagValue


def test_pickle():
    for cls in [TagKey, TagValue, GroupTagKey, GroupTagValue]:
        value = cls(**{name: 1 for name in cls.__slots__})
        pickle.loads(pickle.dumps(value)) == value


def test_sorting():
    for cls in [TagKey, TagValue, GroupTagKey, GroupTagValue]:
        value1 = cls(**{name: 1 for name in cls.__slots__})
        value2 = cls(**{name: 2 for name in cls.__slots__})

        assert value1 < value2
