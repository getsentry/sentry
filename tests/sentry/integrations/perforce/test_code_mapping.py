from unittest.mock import patch

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.perforce.integration import (
    PerforceIntegration,
    PerforceIntegrationProvider,
)
from sentry.issues.auto_source_code_config.code_mapping import (
    convert_stacktrace_frame_path_to_source_path,
)
from sentry.models.repository import Repository
from sentry.testutils.cases import IntegrationTestCase
from sentry.utils.event_frames import EventFrame


class PerforceCodeMappingTest(IntegrationTestCase):
    """Tests for code mapping integration with Perforce"""

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
        self.project = self.create_project(organization=self.organization)
        self.org_integration = self.integration.organizationintegration_set.first()
        assert self.org_integration is not None

    def tearDown(self):
        super().tearDown()

    def test_code_mapping_depot_root_to_slash(self):
        """
        Test code mapping: depot/ -> /
        This is the correct mapping for Perforce where depot name is part of path.
        """
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Test Python SDK path: depot/app/services/processor.py
        frame = EventFrame(
            filename="depot/app/services/processor.py",
            abs_path="depot/app/services/processor.py",
        )

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="python", sdk_name="sentry.python"
        )

        # Should strip "depot/" leaving "app/services/processor.py"
        assert result == "app/services/processor.py"

    def test_code_mapping_with_symbolic_revision_syntax(self):
        """
        Test code mapping with Symbolic's @revision syntax.
        The @revision should be preserved in the output.
        """
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Test C++ path from Symbolic: depot/game/src/main.cpp@42
        frame = EventFrame(
            filename="depot/game/src/main.cpp@42", abs_path="depot/game/src/main.cpp@42"
        )

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="native", sdk_name="sentry.native"
        )

        # Should strip "depot/" and preserve "@42"
        assert result == "game/src/main.cpp@42"

    def test_code_mapping_multiple_depots(self):
        """Test code mappings for multiple depots (depot and myproject)"""
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

        depot_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=depot_repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        myproject_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=myproject_repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="myproject/",
            source_root="/",
            default_branch=None,
        )

        # Test depot path
        frame1 = EventFrame(
            filename="depot/app/services/processor.py",
            abs_path="depot/app/services/processor.py",
        )

        result1 = convert_stacktrace_frame_path_to_source_path(
            frame=frame1, code_mapping=depot_mapping, platform="python", sdk_name="sentry.python"
        )
        assert result1 == "app/services/processor.py"

        # Test myproject path
        frame2 = EventFrame(
            filename="myproject/app/services/handler.py",
            abs_path="myproject/app/services/handler.py",
        )

        result2 = convert_stacktrace_frame_path_to_source_path(
            frame=frame2,
            code_mapping=myproject_mapping,
            platform="python",
            sdk_name="sentry.python",
        )
        assert result2 == "app/services/handler.py"

    def test_code_mapping_no_match_different_depot(self):
        """Test that code mapping doesn't match paths from different depots"""
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Try to match a path from different depot
        frame = EventFrame(
            filename="myproject/app/services/processor.py",
            abs_path="myproject/app/services/processor.py",
        )

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="python", sdk_name="sentry.python"
        )

        # Should not match
        assert result is None

    def test_code_mapping_abs_path_fallback(self):
        """Test that code mapping works with abs_path when filename is just basename"""
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Some platforms only provide basename in filename
        frame = EventFrame(filename="processor.py", abs_path="depot/app/services/processor.py")

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="python", sdk_name="sentry.python"
        )

        # Should use abs_path and strip "depot/"
        assert result == "app/services/processor.py"

    def test_code_mapping_nested_depot_paths(self):
        """Test code mapping with nested depot paths"""
        repo = Repository.objects.create(
            name="//depot/game/project",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot/game/project"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/game/project/",
            source_root="/",
            default_branch=None,
        )

        frame = EventFrame(
            filename="depot/game/project/src/main.cpp",
            abs_path="depot/game/project/src/main.cpp",
        )

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="native", sdk_name="sentry.native"
        )

        assert result == "src/main.cpp"

    def test_code_mapping_preserves_windows_backslash_conversion(self):
        """
        Test that code mapping handles Windows-style paths.

        Note: The generic code_mapping system does not automatically convert
        backslashes to forward slashes. SDKs should normalize paths before
        sending to Sentry. This test documents current behavior.
        """
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Windows-style path with backslashes
        frame = EventFrame(
            filename="depot\\app\\services\\processor.cpp",
            abs_path="depot\\app\\services\\processor.cpp",
        )

        result = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=code_mapping, platform="native", sdk_name="sentry.native"
        )

        # Generic code mapping doesn't normalize backslashes - returns None
        # SDKs should normalize paths to forward slashes before sending
        assert result is None


class PerforceEndToEndCodeMappingTest(IntegrationTestCase):
    """End-to-end tests for code mapping + format_source_url flow"""

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
        self.project = self.create_project(organization=self.organization)
        self.org_integration = self.integration.organizationintegration_set.first()
        assert self.org_integration is not None

        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        self.code_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=self.repo,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Mock the Perforce client's check_file to avoid actual P4 connection
        self.check_file_patcher = patch(
            "sentry.integrations.perforce.client.PerforceClient.check_file",
            return_value={"depotFile": "//depot/mock"},
        )
        self.check_file_patcher.start()

    def tearDown(self):
        self.check_file_patcher.stop()
        super().tearDown()

    def test_python_sdk_path_full_flow(self):
        """Test full flow: Python SDK -> code mapping -> format_source_url"""
        # 1. Python SDK sends this path
        frame = EventFrame(
            filename="depot/app/services/processor.py",
            abs_path="depot/app/services/processor.py",
        )

        # 2. Code mapping transforms it
        mapped_path = convert_stacktrace_frame_path_to_source_path(
            frame=frame,
            code_mapping=self.code_mapping,
            platform="python",
            sdk_name="sentry.python",
        )
        assert mapped_path == "app/services/processor.py"

        # 3. format_source_url creates final URL
        url = self.installation.format_source_url(repo=self.repo, filepath=mapped_path, branch=None)
        assert url == "p4://depot/app/services/processor.py"

    def test_symbolic_cpp_path_full_flow(self):
        """Test full flow: Symbolic C++ -> code mapping -> format_source_url"""
        # 1. Symbolic transformer sends this path
        frame = EventFrame(
            filename="depot/game/src/main.cpp@42", abs_path="depot/game/src/main.cpp@42"
        )

        # 2. Code mapping transforms it (use existing code_mapping from setUp)
        mapped_path = convert_stacktrace_frame_path_to_source_path(
            frame=frame, code_mapping=self.code_mapping, platform="native", sdk_name="sentry.native"
        )
        assert mapped_path == "game/src/main.cpp@42"

        # 3. format_source_url creates final URL (preserves @42)
        url = self.installation.format_source_url(repo=self.repo, filepath=mapped_path, branch=None)
        assert url == "p4://depot/game/src/main.cpp@42"

    def test_full_flow_with_web_viewer(self):
        """Test full flow with P4Web viewer configuration"""
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-web-flow",
            metadata={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
                "auth_type": "password",
                "web_url": "https://p4web.example.com",
            },
        )
        installation: PerforceIntegration = integration_with_web.get_installation(self.organization.id)  # type: ignore[assignment]

        # Create repo with web viewer integration
        repo_web = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=integration_with_web.id,
            config={"depot_path": "//depot"},
        )

        # Use a new project to avoid unique constraint on (project_id, stack_root)
        project_web = self.create_project(organization=self.organization)

        org_integration_web = integration_with_web.organizationintegration_set.first()
        assert org_integration_web is not None

        code_mapping_web = RepositoryProjectPathConfig.objects.create(
            project=project_web,
            organization_id=self.organization.id,
            repository=repo_web,
            organization_integration_id=org_integration_web.id,
            integration_id=integration_with_web.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Python SDK path with #revision from Symbolic
        frame = EventFrame(
            filename="depot/app/services/processor.py#42",
            abs_path="depot/app/services/processor.py#42",
        )

        # Code mapping
        mapped_path = convert_stacktrace_frame_path_to_source_path(
            frame=frame,
            code_mapping=code_mapping_web,
            platform="python",
            sdk_name="sentry.python",
        )

        # format_source_url with web viewer (revision extracted from filename)
        assert mapped_path is not None
        url = installation.format_source_url(repo=repo_web, filepath=mapped_path, branch=None)

        # Swarm format: /files/<depot_path>?v=<revision>
        assert url == "https://p4web.example.com/files//depot/app/services/processor.py?v=42"
