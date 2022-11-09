from sentry.models import ApiApplication
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class ApiApplicationTest(TestCase):
    def test_is_valid_redirect_uri(self):
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )

        assert app.is_valid_redirect_uri("http://example.com/")
        assert app.is_valid_redirect_uri("http://example.com")
        assert app.is_valid_redirect_uri("http://example.com/biz/baz")
        assert not app.is_valid_redirect_uri("https://example.com/")
        assert not app.is_valid_redirect_uri("http://foo.com")
        assert not app.is_valid_redirect_uri("http://example.com.foo.com")

        assert app.is_valid_redirect_uri("http://sub.example.com/path")
        assert app.is_valid_redirect_uri("http://sub.example.com/path/bar")
        assert not app.is_valid_redirect_uri("http://sub.example.com")
        assert not app.is_valid_redirect_uri("https://sub.example.com")

    def test_get_default_redirect_uri(self):
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )

        assert app.get_default_redirect_uri() == "http://example.com"
