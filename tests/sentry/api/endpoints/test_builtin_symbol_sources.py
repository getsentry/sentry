from django.test import override_settings

from sentry.testutils.cases import APITestCase

SENTRY_BUILTIN_SOURCES_PLATFORM_TEST = {
    "public-source-1": {
        "id": "sentry:public-1",
        "name": "Public Source 1",
        "type": "http",
        "url": "https://example.com/symbols/",
    },
    "public-source-2": {
        "id": "sentry:public-2",
        "name": "Public Source 2",
        "type": "http",
        "url": "https://example.com/symbols2/",
    },
    "nintendo": {
        "id": "sentry:nintendo",
        "name": "Nintendo SDK",
        "type": "s3",
        "bucket": "nintendo-symbols",
        "region": "us-east-1",
        "access_key": "test-key",
        "secret_key": "test-secret",
        "layout": {"type": "native"},
        "platforms": ["nintendo-switch"],
    },
}


class BuiltinSymbolSourcesWithSlugTest(APITestCase):
    endpoint = "sentry-api-0-organization-builtin-symbol-sources"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_with_slug(self) -> None:
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 200

        body = resp.data
        assert len(body)
        assert "sentry_key" in body[0]
        assert "id" in body[0]
        assert "name" in body[0]
        assert "hidden" in body[0]


class BuiltinSymbolSourcesPlatformFilteringTest(APITestCase):
    endpoint = "sentry-api-0-organization-builtin-symbol-sources"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_platform_filtering_nintendo_switch_with_access(self) -> None:
        """Nintendo Switch platform should see nintendo source only if org has access"""
        # Enable nintendo-switch for this organization
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])

        resp = self.get_response(self.organization.slug, qs_params={"platform": "nintendo-switch"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Nintendo Switch with access should see nintendo
        assert "nintendo" in source_keys
        # Should also see public sources (no platform restriction)
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_platform_filtering_nintendo_switch_without_access(self) -> None:
        """Nintendo Switch platform should NOT see nintendo if org lacks access"""
        # Organization does not have nintendo-switch enabled (default is empty list)

        resp = self.get_response(self.organization.slug, qs_params={"platform": "nintendo-switch"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Should NOT see nintendo without console platform access
        assert "nintendo" not in source_keys
        # Should still see public sources
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_platform_filtering_unity_without_console_access(self) -> None:
        """Unity platform should NOT see nintendo source without console access"""
        resp = self.get_response(self.organization.slug, qs_params={"platform": "unity"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Unity should see public sources (no platform restriction)
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # Unity should NOT see nintendo without org console access
        assert "nintendo" not in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_platform_filtering_unity_with_console_access(self) -> None:
        """Unity platform SHOULD see nintendo source if org has console access"""
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])

        resp = self.get_response(self.organization.slug, qs_params={"platform": "unity"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Unity should see public sources
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # Unity SHOULD see nintendo because org has console access
        assert "nintendo" in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_no_platform_parameter(self) -> None:
        """Without platform parameter and no console access, should not see platform-restricted sources"""
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Should see public sources (no platform restriction)
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # Should NOT see platform-restricted source without console access
        assert "nintendo" not in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_no_platform_with_console_access(self) -> None:
        """Without platform parameter, should NOT see platform-restricted sources even with access"""
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])

        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Should see public sources
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # Should NOT see nintendo without a gaming platform specified
        assert "nintendo" not in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_non_gaming_platform_with_console_access(self) -> None:
        """Non-gaming platform should NOT see nintendo source even with console access"""
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])

        resp = self.get_response(self.organization.slug, qs_params={"platform": "python"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Should see public sources
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # Python is NOT a game engine platform, so should NOT see nintendo
        assert "nintendo" not in source_keys

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_PLATFORM_TEST)
    def test_other_console_platform_does_not_see_nintendo(self) -> None:
        """PlayStation platform should NOT see nintendo source"""
        self.organization.update_option(
            "sentry:enabled_console_platforms", ["nintendo-switch", "playstation"]
        )

        resp = self.get_response(self.organization.slug, qs_params={"platform": "playstation"})
        assert resp.status_code == 200

        body = resp.data
        source_keys = [source["sentry_key"] for source in body]

        # Should see public sources
        assert "public-source-1" in source_keys
        assert "public-source-2" in source_keys
        # PlayStation should NOT see nintendo (not a matching console or game engine)
        assert "nintendo" not in source_keys
