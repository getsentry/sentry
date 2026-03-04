from django.test import override_settings

from sentry.models.options.project_option import ProjectOption
from sentry.tasks.console_platform_cleanup import remove_revoked_console_platform_sources
from sentry.testutils.cases import TestCase

SENTRY_BUILTIN_SOURCES_TEST = {
    "microsoft": {
        "id": "sentry:microsoft",
        "name": "Microsoft",
        "type": "http",
        "url": "https://msdl.microsoft.com/download/symbols/",
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
    "playstation": {
        "id": "sentry:playstation",
        "name": "PlayStation SDK",
        "type": "s3",
        "bucket": "playstation-symbols",
        "region": "us-east-1",
        "access_key": "test-key",
        "secret_key": "test-secret",
        "layout": {"type": "native"},
        "platforms": ["playstation"],
    },
}


class RemoveRevokedConsolePlatformSourcesTest(TestCase):
    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_removes_revoked_sources(self) -> None:
        """Revoking nintendo-switch access removes 'nintendo' from projects"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_preserves_non_revoked_sources(self) -> None:
        """Only sources for revoked platforms are removed, others are preserved"""
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:builtin_symbol_sources", ["microsoft", "nintendo", "playstation"]
        )

        # Only revoke nintendo-switch, not playstation
        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert "microsoft" in sources
        assert "playstation" in sources
        assert "nintendo" not in sources

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_no_change_when_project_lacks_source(self) -> None:
        """Projects without the revoked source are not modified"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_other_org_projects_unaffected(self) -> None:
        """Projects in other orgs are not modified"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources = ProjectOption.objects.get_value(other_project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft", "nintendo"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_multiple_projects_cleaned_up(self) -> None:
        """All projects in the org are cleaned up"""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project1.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])
        project2.update_option("sentry:builtin_symbol_sources", ["nintendo"])

        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources1 = ProjectOption.objects.get_value(project1, "sentry:builtin_symbol_sources")
        sources2 = ProjectOption.objects.get_value(project2, "sentry:builtin_symbol_sources")
        assert sources1 == ["microsoft"]
        assert sources2 == []

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_noop_when_no_matching_sources(self) -> None:
        """Revoking a platform with no configured sources is a no-op"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        # Revoke a platform that has no sources in SENTRY_BUILTIN_SOURCES
        remove_revoked_console_platform_sources(self.organization.id, ["xbox"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft", "nintendo"]

    @override_settings(
        SENTRY_BUILTIN_SOURCES={
            **SENTRY_BUILTIN_SOURCES_TEST,
            "multi_platform": {
                "id": "sentry:multi_platform",
                "name": "Multi-Platform SDK",
                "type": "s3",
                "bucket": "multi-symbols",
                "region": "us-east-1",
                "access_key": "test-key",
                "secret_key": "test-secret",
                "layout": {"type": "native"},
                "platforms": ["nintendo-switch", "playstation"],
            },
        }
    )
    def test_removes_multi_platform_source_when_only_platform_revoked(self) -> None:
        """
        When a source has multiple platforms and the org only had access to one,
        revoking that platform should remove the source even though not all
        platforms were revoked.
        """
        project = self.create_project(organization=self.organization)
        # Org only has nintendo-switch access, not playstation
        self.organization.update_option("sentry:enabled_console_platforms", ["nintendo-switch"])
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "multi_platform"])

        # Revoke nintendo-switch - the only platform the org had access to
        remove_revoked_console_platform_sources(self.organization.id, ["nintendo-switch"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        # multi_platform should be removed because org no longer has access to any of its platforms
        assert sources == ["microsoft"]
