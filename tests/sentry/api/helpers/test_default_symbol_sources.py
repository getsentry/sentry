from django.test import override_settings

from sentry.api.helpers.default_symbol_sources import set_default_symbol_sources
from sentry.testutils.cases import TestCase

# Mock SENTRY_BUILTIN_SOURCES with a platform-restricted source for testing
SENTRY_BUILTIN_SOURCES_TEST = {
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


class SetDefaultSymbolSourcesTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    def test_no_platform(self):
        """Projects without a platform should keep their epoch defaults"""
        project = self.create_project(organization=self.organization, platform=None)
        # Capture epoch defaults before calling set_default_symbol_sources
        epoch_defaults = project.get_option("sentry:builtin_symbol_sources")

        set_default_symbol_sources(project, self.organization)

        # Should not change the defaults for projects without a platform
        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources == epoch_defaults

    def test_unknown_platform(self):
        """Projects with unknown platforms should keep their epoch defaults"""
        project = self.create_project(organization=self.organization, platform="unknown-platform")
        # Capture epoch defaults before calling set_default_symbol_sources
        epoch_defaults = project.get_option("sentry:builtin_symbol_sources")

        set_default_symbol_sources(project, self.organization)

        # Should not change the defaults for projects with unknown platforms
        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources == epoch_defaults

    def test_electron_platform(self):
        """Electron projects should get the correct default sources"""
        project = self.create_project(organization=self.organization, platform="electron")
        set_default_symbol_sources(project, self.organization)

        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources is not None
        assert "ios" in sources
        assert "microsoft" in sources
        assert "electron" in sources

    def test_unity_platform(self):
        """Unity projects should get the correct default sources"""
        project = self.create_project(organization=self.organization, platform="unity")
        set_default_symbol_sources(project, self.organization)

        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources is not None
        assert "ios" in sources
        assert "microsoft" in sources
        assert "android" in sources
        assert "nuget" in sources
        assert "unity" in sources
        assert "nvidia" in sources
        assert "ubuntu" in sources

    def test_organization_auto_fetch_from_project(self):
        """Function should auto-fetch organization from project if not provided"""
        project = self.create_project(organization=self.organization, platform="electron")
        # Don't pass organization parameter
        set_default_symbol_sources(project)

        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources is not None
        assert "electron" in sources


class PlatformRestrictedSymbolSourcesTest(TestCase):
    """Tests for platform-restricted symbol sources (e.g., console platforms)"""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_nintendo_switch_with_org_access(self):
        """Nintendo Switch project should get nintendo source if org has access"""
        # Grant org access to nintendo-switch console platform
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])

        project = self.create_project(organization=self.organization, platform="nintendo-switch")
        set_default_symbol_sources(project, self.organization)

        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources is not None
        assert "nintendo" in sources

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_nintendo_switch_without_org_access(self):
        """Nintendo Switch project should NOT get nintendo source if org lacks access"""
        # Org has no enabled console platforms (default is empty list)
        project = self.create_project(organization=self.organization, platform="nintendo-switch")
        set_default_symbol_sources(project, self.organization)

        sources = project.get_option("sentry:builtin_symbol_sources")
        # Should be empty since no sources are available (nintendo is restricted)
        assert sources == []

    def test_unity_not_affected_by_console_restrictions(self):
        """Unity projects should get sources regardless of console platform access"""
        # Org has no enabled console platforms
        project = self.create_project(organization=self.organization, platform="unity")
        set_default_symbol_sources(project, self.organization)

        sources = project.get_option("sentry:builtin_symbol_sources")
        assert sources is not None
        # Unity sources have no platform restrictions, so they should all be added
        assert "unity" in sources
        assert "microsoft" in sources
