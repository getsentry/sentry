from __future__ import absolute_import

from unittest import TestCase

import six
from sentry.utils.compat.mock import patch
from sentry.testutils.helpers.faux import faux


def fakefunc(*args, **kwargs):
    pass


@patch("tests.sentry.testutils.helpers.test_faux.fakefunc")
class TestFaux(TestCase):
    def test_args(self, mock):
        fakefunc(True)
        assert faux(mock).args == (True,)

    def test_kwargs(self, mock):
        fakefunc(foo=1)
        assert faux(mock).kwargs == {"foo": 1}

    def test_args_and_kwargs(self, mock):
        fakefunc(True, foo=1)
        assert faux(mock).args == (True,)
        assert faux(mock).kwargs == {"foo": 1}

    def test_called_with(self, mock):
        fakefunc(True, foo=1)
        assert faux(mock).called_with(True, foo=1)

    def test_called_with_error_message(self, mock):
        fakefunc(1)

        try:
            faux(mock).called_with(False)
        except AssertionError as e:
            assert six.text_type(e) == "Expected to be called with (False). Received (1)."

    def test_kwargs_contain(self, mock):
        fakefunc(foo=1)
        assert faux(mock).kwargs_contain("foo")

    def test_kwargs_contain_error_message(self, mock):
        fakefunc(foo=1)

        try:
            faux(mock).kwargs_contain("bar")
        except AssertionError as e:
            assert six.text_type(e) == "Expected kwargs to contain key 'bar'. Received (foo=1)."

    def test_kwarg_equals(self, mock):
        fakefunc(foo=1, bar=2)
        assert faux(mock).kwarg_equals("bar", 2)

    def test_kwarg_equals_error_message(self, mock):
        fakefunc(foo=1, bar=2)

        try:
            faux(mock).kwarg_equals("bar", True)
        except AssertionError as e:
            assert six.text_type(e) == "Expected kwargs[bar] to equal True. Received 2."

    def test_args_contain(self, mock):
        fakefunc(1, False, None)
        assert faux(mock).args_contain(False)

    def test_args_contain_error_message(self, mock):
        fakefunc(1, None, False)

        try:
            faux(mock).args_contain(True)
        except AssertionError as e:
            assert six.text_type(e) == "Expected args to contain True. Received (1, None, False)."

    def test_args_equal(self, mock):
        fakefunc(1, False, None)
        assert faux(mock).args_equals(1, False, None)

    def test_args_equal_error_message(self, mock):
        fakefunc(1, False)

        try:
            faux(mock).args_equals(["beep"])
        except AssertionError as e:
            assert six.text_type(e) == "Expected args to equal (['beep']). Received (1, False)."
