from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class ApiApplicationTest(TestCase):
    def test_is_valid_redirect_uri(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com\nhttp://sub.example.com/path",
            version=0,  # legacy behavior allows prefix match
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

    def test_is_valid_redirect_uri_strict_version(self) -> None:
        # In strict policy version, require exact matching (no prefix, no trailing-slash equivalence).
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://sub.example.com/path", version=1
        )

        # Exact match required
        assert app.is_valid_redirect_uri("http://sub.example.com/path")
        assert not app.is_valid_redirect_uri("http://sub.example.com/path/")

        # Prefix match should be rejected in strict mode
        assert not app.is_valid_redirect_uri("http://sub.example.com/path/bar")

    def test_is_valid_redirect_uri_loopback_ephemeral_port(self) -> None:
        # Register loopback redirect URIs without a port; incoming URIs may use
        # ephemeral ports (RFC 8252 §8.4 / §7).
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris=(
                "http://127.0.0.1/callback\n"
                "http://localhost/callback\n"
                "http://[::1]/callback\n"
                "https://127.0.0.1/callback\n"
                "https://localhost/callback\n"
                "https://[::1]/callback"
            ),
        )

        assert app.is_valid_redirect_uri("http://127.0.0.1:55321/callback")
        assert app.is_valid_redirect_uri("http://localhost:23456/callback")
        assert app.is_valid_redirect_uri("http://[::1]:43123/callback")
        assert app.is_valid_redirect_uri("https://127.0.0.1:55321/callback")
        assert app.is_valid_redirect_uri("https://localhost:23456/callback")
        assert app.is_valid_redirect_uri("https://[::1]:43123/callback")

        # Still exact on other parts
        assert not app.is_valid_redirect_uri("http://127.0.0.1:55321/callback/extra")
        assert not app.is_valid_redirect_uri("http://127.0.0.2:55321/callback")

    def test_is_valid_redirect_uri_loopback_ephemeral_port_scheme_mismatch(self) -> None:
        # If only http is registered, https must not be accepted (scheme must match).
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris=(
                "http://127.0.0.1/callback\n" "http://localhost/callback\n" "http://[::1]/callback"
            ),
        )

        assert not app.is_valid_redirect_uri("https://127.0.0.1:55321/callback")

    def test_is_valid_redirect_uri_loopback_fixed_port_requires_exact(self) -> None:
        # When a port is registered, require exact port match.
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://127.0.0.1:3000/callback",
        )

        assert app.is_valid_redirect_uri("http://127.0.0.1:3000/callback")
        assert not app.is_valid_redirect_uri("http://127.0.0.1:3001/callback")
        assert not app.is_valid_redirect_uri("http://127.0.0.1/callback")

    def test_is_valid_redirect_uri_custom_scheme(self) -> None:
        # Test custom scheme for Apple apps (sentry-apple://)
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="sentry-apple://sentry.io/auth",
            version=0,  # legacy behavior
        )

        # Exact match should work
        assert app.is_valid_redirect_uri("sentry-apple://sentry.io/auth")

        # With trailing slash - depends on normalization
        assert app.is_valid_redirect_uri("sentry-apple://sentry.io/auth/")

        # Prefix match should work in legacy mode
        assert app.is_valid_redirect_uri("sentry-apple://sentry.io/auth/callback")

        # Different scheme should fail
        assert not app.is_valid_redirect_uri("https://sentry.io/auth")

        # Different host should fail
        assert not app.is_valid_redirect_uri("sentry-apple://other.io/auth")

        # Different path should fail (not a prefix)
        assert not app.is_valid_redirect_uri("sentry-apple://sentry.io/other")

    def test_is_valid_redirect_uri_custom_scheme_strict(self) -> None:
        # Test custom scheme with strict validation (version 1)
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="sentry-apple://sentry.io/auth",
            version=1,  # strict mode
        )

        # Exact match should work
        assert app.is_valid_redirect_uri("sentry-apple://sentry.io/auth")

        # Prefix match should NOT work in strict mode
        assert not app.is_valid_redirect_uri("sentry-apple://sentry.io/auth/callback")

    def test_get_default_redirect_uri(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )

        assert app.get_default_redirect_uri() == "http://example.com"

    def test_get_allowed_origins_space_separated(self) -> None:
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

    def test_get_allowed_origins_newline_separated(self) -> None:
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

    def test_get_allowed_origins_none(self) -> None:
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com",
        )

        assert app.get_allowed_origins() == []

    def test_get_allowed_origins_empty_string(self) -> None:
        app = ApiApplication.objects.create(name="origins_test", redirect_uris="")

        assert app.get_allowed_origins() == []

    def test_get_redirect_uris_space_separated(self) -> None:
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com http://example2.com http://example.io",
        )

        assert app.get_redirect_uris() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_get_redirect_uris_newline_separated(self) -> None:
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com\nhttp://example2.com\nhttp://example.io",
        )

        assert app.get_redirect_uris() == [
            "http://example.com",
            "http://example2.com",
            "http://example.io",
        ]

    def test_default_string_serialization(self) -> None:
        app = ApiApplication.objects.create(
            name="origins_test",
            redirect_uris="http://example.com\nhttp://example2.com\nhttp://example.io",
        )

        assert f"{app} is cool" == f"{app.name} is cool"

    def test_client_secret_has_prefix(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com",
        )

        assert app.client_secret.startswith(AuthTokenType.USER_APP)
