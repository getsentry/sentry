from unittest import mock

import pytest

from sentry.runner.commands import run


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        (None, (None, None)),
        ("192.168.1.1", ("192.168.1.1", None)),
        ("192.168.1.1:9001", ("192.168.1.1", 9001)),
    ),
)
def test_address_validate(value, expected):
    ctx, param = mock.Mock(), mock.Mock()
    assert run._address_validate(ctx, param, value) == expected
