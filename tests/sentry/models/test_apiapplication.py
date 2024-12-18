from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiApplicationTest(TestCase):
    def test_is_valid_redirect_uri(self):
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )

        assert app.is_valid_redirect_uri("http://example.com/")
        assert app.is_valid_redirect_uri("http://example.com")
        assert app.is_valid_redirect_uri("http://example.com/.")
        assert app.is_valid_redirect_uri("http://example.com//")
        assert app.is_valid_redirect_uri("http://example.com/biz/baz")
        assert not app.is_valid_redirect_uri("https://example.com/")
        assert not app.is_valid_redirect_uri("http://foo.com")
        assert not app.is_valid_redirect_uri("http://example.com.foo.com")

        assert app.is_valid_redirect_uri("http://sub.example.com/path")
        assert app.is_valid_redirect_uri("http://sub.example.com/path/")
        assert app.is_valid_redirect_uri("http://sub.example.com/path/bar")
        assert not app.is_valid_redirect_uri("http://sub.example.com")
        assert not app.is_valid_redirect_uri("http://sub.example.com/path/../baz")
        assert not app.is_valid_redirect_uri("https://sub.example.com")

    def test_get_default_redirect_uri(self):
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )

        assert app.get_default_redirect_uri() == "http://example.com"

    def test_get_allowed_origins_space_separated(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com",
            allowed_origins="http://example.com http://example2.com http://example.io",
        )

        assert app.get_allowed_origins() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_get_allowed_origins_newline_separated(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com",
            allowed_origins="http://example.com\nhttp://example2.com\nhttp://example.io",
        )

        assert app.get_allowed_origins() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_get_allowed_origins_none(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com",
        )

        assert app.get_allowed_origins() == []

    def test_get_allowed_origins_empty_string(self):
        app = ApiApplication.objects.create(name="origins_test", redirect_uris="")

        assert app.get_allowed_origins() == []

    def test_get_redirect_uris_space_separated(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com http://example2.com http://example.io",
        )

        assert app.get_redirect_uris() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_get_redirect_uris_newline_separated(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com\nhttp://example2.com\nhttp://example.io",
        )

        assert app.get_redirect_uris() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_default_string_serialization(self):
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com\nhttp://example2.com\nhttp://example.io",
        )

        assert f"{app} is cool" == f"{app.name} is cool"
