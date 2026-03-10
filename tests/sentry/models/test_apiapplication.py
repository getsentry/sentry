from urllib.parse import urlparse

from sentry.models.apiapplication import ApiApplication
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiApplicationTest(TestCase):
    def test_is_public_with_null_secret(self) -> None:
        """Public clients are created with client_secret=None (NULL in DB)."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com",
            client_secret=None,
        )
        assert app.is_public is True

    def test_is_public_with_secret(self) -> None:
        """Confidential clients have a client_secret."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com",
            # client_secret defaults to a generated token
        )
        assert app.client_secret is not None
        assert app.is_public is False

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

    def test_is_valid_redirect_uri_encoded_traversal(self) -> None:
        """Percent-encoded path traversal sequences must be resolved before comparison."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/path/path/",
            version=0,
        )

        # Single-encoded traversal (%2e = '.')
        assert not app.is_valid_redirect_uri("http://example.com/path/path/%2e%2e/%2e%2e/new/path")
        assert not app.is_valid_redirect_uri("http://example.com/path/path/%2E%2E/%2E%2E/new/path")

        # Mixed case encoding
        assert not app.is_valid_redirect_uri("http://example.com/path/path/%2e%2E/%2E%2e/new/path")

        # Partial encoding (%2e mixed with literal dot)
        assert not app.is_valid_redirect_uri("http://example.com/path/path/.%2e/.%2e/new/path")
        assert not app.is_valid_redirect_uri("http://example.com/path/path/%2e./%2e./new/path")

    def test_is_valid_redirect_uri_multi_layer_encoding(self) -> None:
        """Multi-layer percent-encoding must be rejected by the prefix match guard."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/path/path/",
            version=0,
        )

        # Double-encoded: %252e%252e → (unquote) %2e%2e → rejected (residual encoding)
        assert not app.is_valid_redirect_uri(
            "http://example.com/path/path/%252e%252e/%252e%252e/new/path"
        )

        # Triple-encoded: %25252e%25252e → (unquote) %252e%252e → rejected
        assert not app.is_valid_redirect_uri(
            "http://example.com/path/path/%25252e%25252e/%25252e%25252e/new/path"
        )

    def test_is_valid_redirect_uri_multi_layer_encoding_after_encoded_delimiters(self) -> None:
        """After full decoding, %23%252e%252e resolves to #.. (a literal dir name, not traversal).

        These are valid sub-paths under the registered prefix.  Security relies
        on the TOCTOU fix which redirects to the normalized form.
        """
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback/",
            version=0,
        )

        # #.. and ?.. are literal directory names, not traversal sequences
        assert app.is_valid_redirect_uri("http://example.com/callback/%23%252e%252e/secret")
        assert app.is_valid_redirect_uri("http://example.com/callback/%3f%252e%252e/secret")

    def test_is_valid_redirect_uri_legitimate_prefix_match_with_guard(self) -> None:
        """Clean sub-paths must still prefix-match after the double-encoding guard."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback/",
            version=0,
        )

        assert app.is_valid_redirect_uri("http://example.com/callback/")
        assert app.is_valid_redirect_uri("http://example.com/callback/extra")
        assert app.is_valid_redirect_uri("http://example.com/callback/deep/nested/path")
        assert not app.is_valid_redirect_uri("http://example.com/other")

    def test_is_valid_redirect_uri_legitimate_encoded_characters(self) -> None:
        """URIs with legitimately encoded characters must not be rejected."""
        # Encoded space in registered URI
        app_space = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/my%20app/",
            version=0,
        )
        assert app_space.is_valid_redirect_uri("http://example.com/my%20app/callback")

        # Non-ASCII (UTF-8 encoded) in registered URI
        app_utf8 = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/caf%C3%A9/",
            version=0,
        )
        assert app_utf8.is_valid_redirect_uri("http://example.com/caf%C3%A9/callback")

        # Literal percent (%25) in registered URI
        app_pct = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/100%25done/",
            version=0,
        )
        assert app_pct.is_valid_redirect_uri("http://example.com/100%25done/callback")

    def test_is_valid_redirect_uri_encoded_slash_traversal(self) -> None:
        """Encoded forward slash (%2f) in traversal sequences must be resolved."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/path/path/",
            version=0,
        )

        assert not app.is_valid_redirect_uri("http://example.com/path/path/..%2f..%2fnew/path")

    def test_is_valid_redirect_uri_encoded_traversal_strict(self) -> None:
        """Encoded traversal must also be rejected in strict mode."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/path/path/",
            version=1,
        )

        assert not app.is_valid_redirect_uri("http://example.com/path/path/%2e%2e/%2e%2e/new/path")
        assert not app.is_valid_redirect_uri(
            "http://example.com/path/path/%252e%252e/%252e%252e/new/path"
        )

    def test_is_valid_redirect_uri_triple_slash_traversal(self) -> None:
        """Non-canonical URIs that normalize to a registered URI pass validation.

        Security relies on the TOCTOU fix in oauth_authorize.py which ensures
        the redirect Location header uses the normalized form, not the raw input.
        """
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/lol/lol/",
            version=0,
        )

        # These normalize to the registered URI, so validation passes.
        # The redirect will use the normalized form (TOCTOU fix).
        assert app.is_valid_redirect_uri("http://example.com/new/path///../../lol/lol/")
        assert app.is_valid_redirect_uri("http://example.com/evil////../lol/lol/")

        # But URIs that normalize to a DIFFERENT path are still rejected.
        assert not app.is_valid_redirect_uri("http://example.com/new/path///../../other/")

    def test_is_valid_redirect_uri_triple_slash_traversal_strict(self) -> None:
        """Strict mode: non-canonical URI normalizing to registered URI passes exact match."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/registered/path/",
            version=1,
        )

        # Normalizes to exactly the registered URI -- exact match passes.
        assert app.is_valid_redirect_uri("http://example.com/evil///../../registered/path/")

        # Normalizes to a different path -- rejected.
        assert not app.is_valid_redirect_uri("http://example.com/evil///../../other/path/")

    def test_is_valid_redirect_uri_null_byte(self) -> None:
        """Null bytes in the path must be rejected."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback/",
            version=0,
        )

        assert not app.is_valid_redirect_uri("http://example.com/callback/%00evil")
        assert not app.is_valid_redirect_uri("http://example.com/callback/\x00evil")
        assert not app.is_valid_redirect_uri("http://example.com/%00/callback/")
        # Double-encoded null byte — must also be caught by full decode
        assert not app.is_valid_redirect_uri("http://example.com/callback/%2500evil")

    def test_is_valid_redirect_uri_null_byte_strict(self) -> None:
        """Null bytes must be rejected in strict mode too."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback",
            version=1,
        )

        assert not app.is_valid_redirect_uri("http://example.com/callback%00")

    def test_is_valid_redirect_uri_backslash(self) -> None:
        """Backslashes in the path must be rejected."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback/",
            version=0,
        )

        assert not app.is_valid_redirect_uri("http://example.com/callback/..\\..\\secret")
        assert not app.is_valid_redirect_uri("http://example.com/callback/%5c..%5c../secret")
        # Double-encoded backslash — must also be caught by full decode
        assert not app.is_valid_redirect_uri("http://example.com/callback/..%255c..%255csecret")

    def test_is_valid_redirect_uri_deep_encoding(self) -> None:
        """Deeply nested percent-encoding (3+ layers) must be resolved and rejected."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/path/path/",
            version=0,
        )

        # Triple-encoded: %25252e → %252e → %2e → .
        assert not app.is_valid_redirect_uri(
            "http://example.com/path/path/%25252e%25252e/%25252e%25252e/new/path"
        )
        # Quadruple-encoded
        assert not app.is_valid_redirect_uri(
            "http://example.com/path/path/%2525252e%2525252e/%2525252e%2525252e/new/path"
        )

    def test_normalize_url_idempotent(self) -> None:
        """Calling normalize_url twice must produce the same result."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/",
        )

        uris = [
            "http://example.com/path/../other",
            "http://example.com/a//b///c",
            "http://example.com/%252e%252e/foo",
            "http://example.com/caf%C3%A9/",
            "http://example.com/100%25done/",
        ]
        for uri in uris:
            once = app.normalize_url(uri)
            twice = app.normalize_url(once)
            assert once == twice, f"Not idempotent for {uri}: {once!r} != {twice!r}"

    def test_normalize_url_preserves_percent_literal_bytes(self) -> None:
        """Percent-encoded non-UTF-8 bytes must not be lossily replaced."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/",
        )

        # %25ab = literal "%ab" — second decode would produce non-UTF-8 byte
        # 0xAB, which must NOT be replaced with U+FFFD (%EF%BF%BD).
        result = app.normalize_url("http://example.com/%25ab/")
        assert "%EF%BF%BD" not in result
        # The literal %ab is preserved (re-encoded as %25ab by quote)
        assert "%25ab" in result.lower()

        # %2580 = literal "%80" — same pattern with a continuation byte
        result = app.normalize_url("http://example.com/%2580/")
        assert "%EF%BF%BD" not in result
        assert "%2580" in result.lower()

    def _assert_no_bypass(self, app, attack_uri, registered_path):
        """Verify an attack URI cannot redirect outside the registered path.

        Passes if EITHER validation rejects the URI, OR the normalized
        form (what the TOCTOU fix actually redirects to) stays under the
        registered path prefix.
        """
        valid = app.is_valid_redirect_uri(attack_uri)
        if not valid:
            return

        normalized_path = urlparse(app.normalize_url(attack_uri)).path
        assert normalized_path.startswith(registered_path), (
            f"BYPASS: {attack_uri!r} passed validation and normalizes to "
            f"{normalized_path!r}, outside registered prefix {registered_path!r}"
        )

    def test_bypass_quadruple_encoded_traversal(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/a/b/c/d/",
            version=0,
        )
        attacks = [
            # %2525252e = quadruple-encoded "."
            "http://example.com/a/b/c/d/"
            "%2525252e%2525252e/%2525252e%2525252e/"
            "%2525252e%2525252e/%2525252e%2525252e/evil",
            # quadruple-encoded slash
            "http://example.com/a/b/c/d/..%2525252f..%2525252fevil",
            # mixed single + quadruple
            "http://example.com/a/b/c/d/%2e%2e/%2525252e%2525252e/evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/a/b/c/d/")

    def test_bypass_many_slashes_with_traversal(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/safe/path/",
            version=0,
        )
        attacks = [
            "http://example.com/evil//////////../../../safe/path/",
            "http://example.com/evil/////../////../safe/path/",
            "http://example.com////////evil/../../safe/path/",
            "http://example.com/safe/path/////../../../../evil",
            "http://example.com/safe/path////../////../evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/safe/path/")

    def test_bypass_excessive_traversal_depth(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/a/",
            version=0,
        )
        attacks = [
            "http://example.com/a/../../../../../../evil",
            "http://example.com/a/" + "../" * 20 + "evil",
            "http://example.com/a/" + "../" * 100 + "evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/a/")

    def test_bypass_encoded_slash_with_encoded_dots(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/safe/path/",
            version=0,
        )
        attacks = [
            "http://example.com/safe/path/..%2f..%2fevil",
            "http://example.com/safe/path/..%2F..%2Fevil",
            "http://example.com/safe/path/..%252f..%252fevil",
            "http://example.com/safe/path/%252e%252e%252f%252e%252e%252fevil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/safe/path/")

    def test_bypass_dot_segment_variations(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/safe/",
            version=0,
        )
        attacks = [
            "http://example.com/safe/./../../evil",
            "http://example.com/safe/./../evil",
            "http://example.com/safe/%2e/%2e%2e/evil",
            "http://example.com/safe/%2e%2e/%2e/evil",
            "http://example.com/safe/foo/./../../evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/safe/")

    def test_bypass_null_byte_variations(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback/",
            version=0,
        )
        attacks = [
            "http://example.com/callback/%00/../../../evil",
            "http://example.com/callback/\x00/../evil",
            "http://example.com/%00callback/",
            "http://example.com/callback/%2500/../evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/callback/")

    def test_bypass_backslash_variations(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/safe/path/",
            version=0,
        )
        attacks = [
            "http://example.com/safe/path/..\\..\\evil",
            "http://example.com/safe/path/..%5c..%5cevil",
            "http://example.com/safe/path/..%5C..%5Cevil",
            "http://example.com/safe/path/..%255c..%255cevil",
            "http://example.com/safe/path/..\\../evil",
        ]
        for uri in attacks:
            self._assert_no_bypass(app, uri, "/safe/path/")

    def test_bypass_original_vuln_reports(self) -> None:
        """Exact vectors from the two vulnerability reports."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/lol/lol/",
            version=0,
        )
        # Report 1: double-encoded traversal
        self._assert_no_bypass(
            app,
            "http://example.com/lol/lol/%252e%252e/%252e%252e/new/path",
            "/lol/lol/",
        )
        # Report 2: triple-slash traversal
        self._assert_no_bypass(
            app,
            "http://example.com/new/path///../../lol/lol/",
            "/lol/lol/",
        )

    def test_bypass_strict_mode_attacks(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/callback",
            version=1,
        )
        attacks = [
            "http://example.com/callback/../evil",
            "http://example.com/evil/../callback",
            "http://example.com/callback/%2e%2e/evil",
            "http://example.com/callback/%252e%252e/evil",
            "http://example.com/callback//",
            "http://example.com//callback",
            "http://example.com/callback/extra",
            "http://example.com/callback%00",
            "http://example.com/callback%5c..%5cevil",
        ]
        for uri in attacks:
            valid = app.is_valid_redirect_uri(uri)
            if valid:
                normalized = app.normalize_url(uri)
                assert normalized == "http://example.com/callback", (
                    f"Strict bypass: {uri!r} normalizes to {normalized!r}"
                )

    def test_bypass_scheme_and_host_confusion(self) -> None:
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="https://example.com/callback/",
            version=0,
        )
        attacks = [
            "http://example.com/callback/",
            "ftp://example.com/callback/",
            "http://evil.example.com/callback/",
            "http://example.com.evil.com/callback/",
            "http://evil@example.com/callback/",
        ]
        for uri in attacks:
            assert not app.is_valid_redirect_uri(uri), f"Should reject: {uri!r}"

    def test_normalize_url_output_has_no_traversal_or_double_slashes(self) -> None:
        """The output of normalize_url must never contain raw .. or //."""
        app = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris="http://example.com/a/b/c/",
            version=0,
        )
        attacks = [
            "http://example.com/a/b/c/../../evil",
            "http://example.com/a/b/c/%2e%2e/%2e%2e/evil",
            "http://example.com/a/b/c/%252e%252e/%252e%252e/evil",
            "http://example.com/a/b/c/%25252e%25252e/evil",
            "http://example.com/evil///../../a/b/c/",
            "http://example.com/a/b/c/..%2f..%2fevil",
            "http://example.com/a/b/c//extra",
            "http://example.com/a/b/c/////deep",
        ]
        for uri in attacks:
            path = urlparse(app.normalize_url(uri)).path
            assert ".." not in path.split("/"), (
                f"normalize_url({uri!r}) → path {path!r} still has '..'"
            )
            assert "//" not in path, f"normalize_url({uri!r}) → path {path!r} still has '//'"

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
                "http://127.0.0.1/callback\nhttp://localhost/callback\nhttp://[::1]/callback"
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
