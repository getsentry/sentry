from __future__ import absolute_import

import pytest
import six

from sentry.similarity.encoder import Encoder


def test_builtin_types():
    encoder = Encoder()
    values = [
        1,
        1.1,
        b"\x00\x01\x02",
        u"\N{SNOWMAN}",
        ("a", "b", "c"),
        ["a", "b", "c"],
        {"a": 1, "b": 2, "c": 3},
        set(["a", "b", "c"]),
        frozenset(["a", "b", "c"]),
        [{"a": 1}, set("b"), ["c"], u"text"],
    ]

    try:
        values.append(long(1))  # noqa
    except NameError:
        pass

    for value in values:
        encoded = encoder.dumps(value)
        assert isinstance(encoded, six.binary_type)

    with pytest.raises(TypeError):
        encoder.dumps(object())


def test_custom_types():
    class Widget(object):
        def __init__(self, color):
            self.color = color

    encoder = Encoder({Widget: lambda i: {"color": i.color}})

    assert encoder.dumps(Widget("red")) == encoder.dumps({"color": "red"})
