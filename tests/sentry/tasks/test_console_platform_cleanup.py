from django.test import override_settings

from sentry.models.options.project_option import ProjectOption
from sentry.tasks.console_platform_cleanup import remove_inaccessible_console_platform_sources
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
    "multi-console": {
        "id": "sentry:multi-console",
        "name": "Multi Console SDK",
        "type": "s3",
        "bucket": "multi-console-symbols",
        "region": "us-east-1",
        "access_key": "test-key",
        "secret_key": "test-secret",
        "layout": {"type": "native"},
        "platforms": ["nintendo-switch", "playstation"],
    },
}


class RemoveInaccessibleConsolePlatformSourcesTest(TestCase):
    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_removes_sources_for_revoked_platform(self) -> None:
        """Revoking nintendo-switch access removes 'nintendo' from projects"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        # current_platforms after revocation: no console access left
        remove_inaccessible_console_platform_sources(self.organization.id, [])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_preserves_sources_for_remaining_platforms(self) -> None:
        """Only sources for inaccessible platforms are removed"""
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:builtin_symbol_sources", ["microsoft", "nintendo", "playstation"]
        )

        # Org still has playstation, lost nintendo-switch
        remove_inaccessible_console_platform_sources(self.organization.id, ["playstation"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert "microsoft" in sources
        assert "playstation" in sources
        assert "nintendo" not in sources

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_no_change_when_project_lacks_source(self) -> None:
        """Projects without the inaccessible source are not modified"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft"])

        remove_inaccessible_console_platform_sources(self.organization.id, [])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_other_org_projects_unaffected(self) -> None:
        """Projects in other orgs are not modified"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        remove_inaccessible_console_platform_sources(self.organization.id, [])

        sources = ProjectOption.objects.get_value(other_project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft", "nintendo"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_multiple_projects_cleaned_up(self) -> None:
        """All projects in the org are cleaned up"""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project1.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])
        project2.update_option("sentry:builtin_symbol_sources", ["nintendo"])

        remove_inaccessible_console_platform_sources(self.organization.id, [])

        sources1 = ProjectOption.objects.get_value(project1, "sentry:builtin_symbol_sources")
        sources2 = ProjectOption.objects.get_value(project2, "sentry:builtin_symbol_sources")
        assert sources1 == ["microsoft"]
        assert sources2 == []

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_noop_when_all_platforms_still_accessible(self) -> None:
        """No changes when org still has access to all platforms"""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "nintendo"])

        remove_inaccessible_console_platform_sources(
            self.organization.id, ["nintendo-switch", "playstation"]
        )

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft", "nintendo"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_multi_platform_source_removed_when_no_platforms_accessible(self) -> None:
        """A multi-platform source is removed when the org has access to none
        of its platforms."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "multi-console"])

        # Org has no console access at all
        remove_inaccessible_console_platform_sources(self.organization.id, [])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert sources == ["microsoft"]

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_multi_platform_source_kept_when_one_platform_still_accessible(self) -> None:
        """A multi-platform source is preserved when the org still has access
        to at least one of its platforms."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:builtin_symbol_sources", ["microsoft", "multi-console"])

        # Org lost nintendo-switch but still has playstation
        remove_inaccessible_console_platform_sources(self.organization.id, ["playstation"])

        sources = ProjectOption.objects.get_value(project, "sentry:builtin_symbol_sources")
        assert "microsoft" in sources
        assert "multi-console" in sources

    @override_settings(SENTRY_BUILTIN_SOURCES=SENTRY_BUILTIN_SOURCES_TEST)
    def test_nonexistent_organization(self) -> None:
        """Task gracefully handles a nonexistent organization"""
        remove_inaccessible_console_platform_sources(999999999, [])
        # Should not raise
