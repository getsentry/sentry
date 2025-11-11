from sentry.integrations.perforce.integration import (
    PerforceIntegration,
    PerforceIntegrationProvider,
)
from sentry.models.repository import Repository
from sentry.testutils.cases import IntegrationTestCase


class PerforceIntegrationTest(IntegrationTestCase):
    provider = PerforceIntegrationProvider
    installation: PerforceIntegration

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_format_source_url_absolute_path(self):
        """Test formatting URL with absolute depot path"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="//depot/app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_relative_path(self):
        """Test formatting URL with relative path - should prepend depot_path"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_with_revision_in_filename(self):
        """
        Test formatting URL with revision in filename (from Symbolic transformer).
        Perforce uses @ for revisions, which should be preserved.
        """
        url = self.installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp@42", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp@42"

    def test_format_source_url_p4web_viewer(self):
        """Test formatting URL for P4Web viewer with revision in filename"""
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-web",
            metadata={
                "web_url": "https://p4web.example.com",
                "web_viewer_type": "p4web",
            },
        )
        installation: PerforceIntegration = integration_with_web.get_installation(self.organization.id)  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp@42", branch=None
        )
        assert url == "https://p4web.example.com//depot/app/services/processor.cpp?ac=64&rev1=42"

    def test_format_source_url_p4web_viewer_no_revision(self):
        """Test formatting URL for P4Web viewer without revision"""
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-web2",
            metadata={
                "web_url": "https://p4web.example.com",
                "web_viewer_type": "p4web",
            },
        )
        installation: PerforceIntegration = integration_with_web.get_installation(self.organization.id)  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "https://p4web.example.com//depot/app/services/processor.cpp?ac=64"

    def test_format_source_url_swarm_viewer(self):
        """Test formatting URL for Swarm viewer with revision"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm",
            metadata={
                "web_url": "https://swarm.example.com",
                "web_viewer_type": "swarm",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(self.organization.id)  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp@42", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp?v=42"

    def test_format_source_url_swarm_viewer_no_revision(self):
        """Test formatting URL for Swarm viewer without revision"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm2",
            metadata={
                "web_url": "https://swarm.example.com",
                "web_viewer_type": "swarm",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(self.organization.id)  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp"

    def test_format_source_url_strips_leading_slash_from_relative_path(self):
        """Test that leading slash is stripped from relative paths"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="/app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_uses_repo_name_as_fallback_depot(self):
        """Test that repo name is used as depot_path fallback"""
        repo_without_config = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={},
        )

        url = self.installation.format_source_url(
            repo=repo_without_config, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "p4://myproject/app/services/processor.cpp"

    def test_check_file_absolute_depot_path(self):
        """Test check_file with absolute depot path"""
        assert self.installation.check_file(self.repo, "//depot/app/services/processor.cpp")

    def test_check_file_relative_path(self):
        """Test check_file with relative path"""
        assert self.installation.check_file(self.repo, "app/services/processor.cpp")

    def test_check_file_with_revision_syntax(self):
        """Test check_file with @revision syntax"""
        assert self.installation.check_file(self.repo, "app/services/processor.cpp@42")

    def test_get_stacktrace_link(self):
        """Test get_stacktrace_link returns format_source_url result"""
        filepath = "app/services/processor.cpp@42"
        default_branch = ""  # Perforce doesn't require default_branch (used for streams)
        version = None

        url = self.installation.get_stacktrace_link(self.repo, filepath, default_branch, version)
        # URL will be encoded by get_stacktrace_link
        assert url == "p4://depot/app/services/processor.cpp%4042"
        assert "%40" in url  # @ gets URL-encoded to %40

    def test_integration_name(self):
        """Test integration has correct name"""
        assert self.installation.model.name == "Perforce"

    def test_integration_provider(self):
        """Test integration has correct provider"""
        assert self.installation.model.provider == "perforce"


class PerforceIntegrationCodeMappingTest(IntegrationTestCase):
    """Tests for Perforce integration with code mappings"""

    provider = PerforceIntegrationProvider

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_format_source_url_from_code_mapping_output(self):
        """
        Test that paths coming from code mapping (depot/ -> /) work correctly.
        Code mapping strips 'depot/' and leaves 'app/services/processor.cpp',
        which should be prepended with depot_path.
        """
        # This is what code mapping would output after stripping "depot/"
        code_mapped_path = "app/services/processor.cpp"

        url = self.installation.format_source_url(
            repo=self.repo, filepath=code_mapped_path, branch=None
        )

        # Should prepend depot_path to create full depot path
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_preserves_revision_in_filename(self):
        """
        Test that @revision syntax in filename is preserved.
        This tests the Symbolic transformer output format.
        """
        # This is what Symbolic transformer outputs
        symbolic_path = "app/services/processor.cpp@42"

        url = self.installation.format_source_url(
            repo=self.repo, filepath=symbolic_path, branch=None
        )

        # The @42 should be preserved in the path
        assert url == "p4://depot/app/services/processor.cpp@42"

    def test_format_source_url_python_path_without_revision(self):
        """Test Python SDK paths without revision"""
        # Python SDK typically doesn't include revisions
        python_path = "app/services/processor.py"

        url = self.installation.format_source_url(repo=self.repo, filepath=python_path, branch=None)

        assert url == "p4://depot/app/services/processor.py"


class PerforceIntegrationDepotPathTest(IntegrationTestCase):
    """Tests for depot path handling in different scenarios"""

    provider = PerforceIntegrationProvider

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
        )
        self.installation = self.integration.get_installation(self.organization.id)

    def test_multiple_depots(self):
        """Test handling multiple depot configurations"""
        depot_repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        myproject_repo = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//myproject"},
        )

        # Test depot
        url1 = self.installation.format_source_url(
            repo=depot_repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url1 == "p4://depot/app/services/processor.cpp"

        # Test myproject
        url2 = self.installation.format_source_url(
            repo=myproject_repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url2 == "p4://myproject/app/services/processor.cpp"

    def test_nested_depot_paths(self):
        """Test handling nested depot paths"""
        repo = Repository.objects.create(
            name="//depot/game/project",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot/game/project"},
        )

        url = self.installation.format_source_url(repo=repo, filepath="src/main.cpp", branch=None)
        assert url == "p4://depot/game/project/src/main.cpp"

    def test_depot_path_with_trailing_slash(self):
        """Test depot_path with trailing slash is handled correctly"""
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot/"},
        )

        url = self.installation.format_source_url(
            repo=repo, filepath="app/services/processor.cpp", branch=None
        )
        # Should not have double slashes in path portion
        assert url == "p4://depot/app/services/processor.cpp"


class PerforceIntegrationWebViewersTest(IntegrationTestCase):
    """Tests for web viewer URL formatting"""

    provider = PerforceIntegrationProvider

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_p4web_extracts_revision_from_filename(self):
        """Test P4Web viewer correctly extracts and formats revision from @revision syntax"""
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-p4web",
            metadata={
                "web_url": "https://p4web.example.com",
                "web_viewer_type": "p4web",
            },
        )
        installation: PerforceIntegration = integration_with_web.get_installation(self.organization.id)  # type: ignore[assignment]

        # Filename with revision
        url = installation.format_source_url(
            repo=self.repo, filepath="game/src/main.cpp@42", branch=None
        )

        # Should extract @42 and use it as rev1 parameter
        assert url == "https://p4web.example.com//depot/game/src/main.cpp?ac=64&rev1=42"

    def test_swarm_extracts_revision_from_filename(self):
        """Test Swarm viewer correctly extracts and formats revision from @revision syntax"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm3",
            metadata={
                "web_url": "https://swarm.example.com",
                "web_viewer_type": "swarm",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(self.organization.id)  # type: ignore[assignment]

        # Filename with revision
        url = installation.format_source_url(
            repo=self.repo, filepath="game/src/main.cpp@42", branch=None
        )

        # Should extract @42 and use it as v parameter
        assert url == "https://swarm.example.com/files//depot/game/src/main.cpp?v=42"

    def test_web_viewer_with_python_path_no_revision(self):
        """Test web viewers work correctly without revision"""
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-p4web2",
            metadata={
                "web_url": "https://p4web.example.com",
                "web_viewer_type": "p4web",
            },
        )
        installation: PerforceIntegration = integration_with_web.get_installation(self.organization.id)  # type: ignore[assignment]

        # Python path without revision
        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.py", branch=None
        )

        # Should not have revision parameter
        assert url == "https://p4web.example.com//depot/app/services/processor.py?ac=64"
        assert "rev1=" not in url
