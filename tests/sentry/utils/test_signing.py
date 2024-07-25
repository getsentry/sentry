import pytest
from django.core.signing import BadSignature

from sentry.testutils.cases import TestCase
from sentry.utils.signing import sign, unsign


class SigningTestCase(TestCase):
    def test_sign(self):
        with self.settings(SECRET_KEY="a"):
            # standard case
            assert unsign(sign(foo="bar")) == {"foo": "bar"}

            # sign with aaa, unsign with aaa
            assert unsign(sign(foo="bar", salt="aaa"), salt="aaa") == {"foo": "bar"}

            # sign with aaa, unsign with bbb
            with pytest.raises(BadSignature):
                unsign(sign(foo="bar", salt="aaa"), salt="bbb")

    def test_backward_compatible_sign(self):
        with self.settings(SECRET_KEY="a"):
            # sign with old salt, unsign with new (transitional period)
            assert unsign(sign(foo="bar"), salt="new") == {"foo": "bar"}

            # sign with new salt, unsign with old
            with pytest.raises(BadSignature):
                unsign(sign(foo="bar", salt="new"))
