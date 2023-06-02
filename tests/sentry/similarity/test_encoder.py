import pytest

from sentry.similarity.encoder import Encoder


def test_builtin_types():
    encoder = Encoder()
    values = [
        1,
        1.1,
        b"\x00\x01\x02",
        "\N{SNOWMAN}",
        ("a", "b", "c"),
        ["a", "b", "c"],
        {"a": 1, "b": 2, "c": 3},
        {"a", "b", "c"},
        frozenset(["a", "b", "c"]),
        [{"a": 1}, set("b"), ["c"], "text"],
    ]

    for value in values:
        encoded = encoder.dumps(value)
        assert isinstance(encoded, bytes)

    with pytest.raises(TypeError):
        encoder.dumps(object())


def test_custom_types():
    class Widget:
        def __init__(self, color):
            self.color = color

    encoder = Encoder({Widget: lambda i: {"color": i.color}})

    assert encoder.dumps(Widget("red")) == encoder.dumps({"color": "red"})
