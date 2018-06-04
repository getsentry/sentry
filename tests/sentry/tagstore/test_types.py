import pickle
from sentry.tagstore.types import TagKey, TagValue, GroupTagKey, GroupTagValue


def test_pickle():
    for cls in [TagKey, TagValue, GroupTagKey, GroupTagValue]:
        value = cls(**{name: 1 for name in cls.__slots__})
        pickle.loads(pickle.dumps(value)) == value
