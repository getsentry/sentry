from django.core.handlers.wsgi import WSGIHandler
from django.core.signals import request_finished
from django.http import HttpRequest
from freezegun import freeze_time

from sentry import app
from sentry.testutils import TestCase
from sentry.utils.request_cache import clear_cache, request_cache


class CountCalls:
    def __init__(self, func):
        self._count = 0
        self._func = func

    def __call__(self, *args, **kwargs):
        self._count += 1
        return self._func(*args, **kwargs)

    @property
    def call_count(self):
        return self._count

    def reset_count(self):
        self._count = 0


@CountCalls
def some_func():
    pass


@request_cache
def cached_fn(arg1, arg2=None):
    # call this so we can see how often it's called
    some_func()
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
        app.env.request = None
        request_finished.send(sender=WSGIHandler)
        request_finished.receivers = self.original_receivers
        some_func.reset_count()
        super().tearDown()

    @freeze_time()
    def test_basic_cache(self):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert some_func.call_count == 1

    @freeze_time()
    def test_cache_none(self):
        app.env.request = HttpRequest()
        assert cached_fn(None) is None
        assert cached_fn(None) is None
        assert some_func.call_count == 1

    @freeze_time()
    def test_different_args(self):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("hey", arg2="dog") == "heydog"
        assert some_func.call_count == 2

    @freeze_time()
    def test_different_kwargs(self):
        app.env.request = HttpRequest()
        assert cached_fn("cat", arg2="dog") == "catdog"
        assert cached_fn("cat", arg2="hat") == "cathat"
        assert some_func.call_count == 2

    @freeze_time()
    def test_different_request(self):
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        request_finished.send(sender=WSGIHandler)
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        assert some_func.call_count == 2

    @freeze_time()
    def test_request_over(self):
        app.env.request = HttpRequest()
        assert cached_fn("cat") == "cat"
        app.env.request = None
        assert cached_fn("cat") == "cat"
        assert some_func.call_count == 2
