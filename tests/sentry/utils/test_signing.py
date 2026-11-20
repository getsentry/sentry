import pytest
from django.core.signing import BadSignature

from sentry.testutils.cases import TestCase
from sentry.utils.signing import sign, unsign


class SigningTestCase(TestCase):
    def test_sign(self) -> None:
        with self.settings(SECRET_KEY="a"):
            # standard case
            assert unsign(sign(foo="bar")) == {"foo": "bar"}

            # sign with aaa, unsign with aaa
            assert unsign(sign(foo="bar", salt="aaa"), salt="aaa") == {"foo": "bar"}

            # sign with aaa, unsign with bbb
            with pytest.raises(BadSignature):
                unsign(sign(foo="bar", salt="aaa"), salt="bbb")

    def test_unsign_malformed_value_raises_bad_signature(self) -> None:
        # "zzzz" is valid base64 but decodes to bytes that are not valid UTF-8
        with pytest.raises(BadSignature):
            unsign("zzzz")

        # a single character is not valid base64 at all
        with pytest.raises(BadSignature):
            unsign("a")
