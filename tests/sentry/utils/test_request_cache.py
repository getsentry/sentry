from unittest.mock import patch

from django.core.handlers.wsgi import WSGIHandler
from django.core.signals import request_finished
from django.http import HttpRequest
from django.utils import timezone

from sentry import app
from sentry.testutils.cases import TestCase
from sentry.utils.request_cache import clear_cache, request_cache


@request_cache
def cached_fn(arg1, arg2=None):
    # call this so we can mock it and see how often it's called
    timezone.now()
    if arg2:
        return arg1 + arg2
    return arg1


class RequestCacheTest(TestCase):
    def setUp(self):
        self.original_receivers = request_finished.receivers
        request_finished.receivers = []
        request_finished.connect(clear_cache)
        super().setUp()

    def tearDown(self):
        # remove the request, trigger the signal to clear the cache, restore receivers
        app.env.clear()
        request_finished.send(sender=WSGIHandler)
        request_finished.receivers = self.original_receivers
        super().tearDown()

    @patch("django.utils.timezone.now")
    def test_basic_cache(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert mock_now.call_count == 1

    @patch("django.utils.timezone.now")
    def test_cache_none(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn(None) is None
        assert cached_fn(None) is None
        assert mock_now.call_count == 1

    @patch("django.utils.timezone.now")
    def test_different_args(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("hey", arg2="dog") == "heydog"
        assert mock_now.call_count == 2

    @patch("django.utils.timezone.now")
    def test_different_kwargs(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("cat", arg2="hat") == "cathat"
        assert mock_now.call_count == 2

    @patch("django.utils.timezone.now")
    def test_different_request(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        request_finished.send(sender=WSGIHandler)
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        assert mock_now.call_count == 2

    @patch("django.utils.timezone.now")
    def test_request_over(self, mock_now):
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        app.env.clear()
        assert cached_fn("cat") == "cat"
        assert mock_now.call_count == 2
