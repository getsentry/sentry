import pytest
from django.core.signing import BadSignature
from django.test import override_settings

from sentry.utils.signing import sign, unsign


@override_settings(SECRET_KEY="a")
def test_sign() -> None:
    # standard case
    assert unsign(sign(foo="bar")) == {"foo": "bar"}

    # sign with aaa, unsign with aaa
    assert unsign(sign(foo="bar", salt="aaa"), salt="aaa") == {"foo": "bar"}

    # sign with aaa, unsign with bbb
    with pytest.raises(BadSignature):
        unsign(sign(foo="bar", salt="aaa"), salt="bbb")
