import functools


# TODO(dcramer): pull in enum library
class TagKeyStatus:
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


@functools.total_ordering
class TagType:
    _sort_key = None

    def __repr__(self):
        return "<{}: {}>".format(
            type(self).__name__,
            ", ".join(f"{name}={getattr(self, name)!r}" for name in self.__slots__),
        )

    def __hash__(self):
        return hash(tuple([getattr(self, name) for name in self.__slots__]))

    def __eq__(self, other):
        return type(self) == type(other) and all(
            getattr(self, name) == getattr(other, name) for name in self.__slots__
        )

    def __lt__(self, other):
        return getattr(self, self._sort_key) < getattr(other, self._sort_key)

    def __getstate__(self):
        return {name: getattr(self, name) for name in self.__slots__}

    def __setstate__(self, state):
        for name, value in state.items():
            setattr(self, name, value)


class TagKey(TagType):
    __slots__ = ["key", "values_seen", "status"]
    _sort_key = "values_seen"

    def __init__(
        self, key, values_seen=None, status=TagKeyStatus.VISIBLE, count=None, top_values=None
    ):
        self.key = key
        self.values_seen = values_seen
        self.status = status
        self.count = count
        self.top_values = top_values

    def get_audit_log_data(self):
        return {"key": self.key}


class TagValue(TagType):
    __slots__ = ["key", "value", "times_seen", "first_seen", "last_seen"]
    _sort_key = "value"

    def __init__(self, key, value, times_seen, first_seen, last_seen):
        self.key = key
        self.value = value
        self.times_seen = times_seen
        self.first_seen = first_seen
        self.last_seen = last_seen


class GroupTagKey(TagType):
    __slots__ = ["group_id", "key", "values_seen"]
    _sort_key = "values_seen"

    def __init__(self, group_id, key, values_seen=None, count=None, top_values=None):
        self.group_id = group_id
        self.key = key
        self.values_seen = values_seen
        self.count = count
        self.top_values = top_values


class GroupTagValue(TagType):
    __slots__ = ["group_id", "key", "value", "times_seen", "first_seen", "last_seen"]
    _sort_key = "value"

    def __init__(self, group_id, key, value, times_seen, first_seen, last_seen):
        self.group_id = group_id
        self.key = key
        self.value = value
        self.times_seen = times_seen
        self.first_seen = first_seen
        self.last_seen = last_seen
