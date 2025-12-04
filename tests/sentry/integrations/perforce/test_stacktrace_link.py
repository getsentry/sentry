from unittest.mock import patch

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.perforce.integration import PerforceIntegrationProvider
from sentry.integrations.utils.stacktrace_link import get_stacktrace_config
from sentry.issues.endpoints.project_stacktrace_link import StacktraceLinkContext
from sentry.models.repository import Repository
from sentry.testutils.cases import IntegrationTestCase


class PerforceStacktraceLinkTest(IntegrationTestCase):
    """Tests for Perforce stacktrace link generation"""

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
            organization_integration_id=self.integration.organizationintegration_set.first().id,
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

    def test_get_stacktrace_config_python_path(self):
        """Test stacktrace link generation for Python SDK path"""
        self.check_file_patcher.stop()
        self.check_file_patcher = patch(
            "sentry.integrations.perforce.client.PerforceClient.check_file",
            return_value={"depotFile": "//depot/app/services/processor.py"},
        )
        self.check_file_patcher.start()
        ctx: StacktraceLinkContext = {
            "file": "depot/app/services/processor.py",
            "filename": "depot/app/services/processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        assert "//depot/app/services/processor.py" in result["source_url"]
        assert result["error"] is None
        assert result["src_path"] == "app/services/processor.py"

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_cpp_path_with_revision(self, mock_check_file):
        """Test stacktrace link generation for C++ path with #revision"""
        mock_check_file.return_value = {"depotFile": "//depot/game/src/main.cpp"}
        ctx: StacktraceLinkContext = {
            "file": "depot/game/src/main.cpp#1",
            "filename": "depot/game/src/main.cpp#1",
            "abs_path": "depot/game/src/main.cpp#1",
            "platform": "native",
            "sdk_name": "sentry.native",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        # URL will be encoded: p4://depot/game/src/main.cpp%231
        assert "depot/game/src/main.cpp" in result["source_url"]
        assert result["error"] is None
        assert result["src_path"] == "game/src/main.cpp#1"

    def test_get_stacktrace_config_no_matching_code_mapping(self):
        """Test stacktrace link when no code mapping matches"""
        ctx: StacktraceLinkContext = {
            "file": "other/app/services/processor.py",
            "filename": "other/app/services/processor.py",
            "abs_path": "other/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping], ctx)

        assert result["source_url"] is None
        assert result["error"] == "stack_root_mismatch"
        assert result["src_path"] is None

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_multiple_code_mappings(self, mock_check_file):
        """Test stacktrace link with multiple code mappings"""
        mock_check_file.return_value = {"depotFile": "//myproject/app/services/handler.py"}
        # Add another depot mapping
        myproject_repo = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//myproject"},
        )

        myproject_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=myproject_repo,
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="myproject/",
            source_root="/",
            default_branch=None,
        )

        # Test with myproject path
        ctx: StacktraceLinkContext = {
            "file": "myproject/app/services/handler.py",
            "filename": "myproject/app/services/handler.py",
            "abs_path": "myproject/app/services/handler.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping, myproject_mapping], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        assert "//myproject/app/services/handler.py" in result["source_url"]
        assert result["src_path"] == "app/services/handler.py"

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_with_web_viewer(self, mock_check_file):
        """Test stacktrace link with P4Web viewer"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.py"}
        integration_with_web = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-web-link",
            metadata={
                "web_url": "https://p4web.example.com",
            },
        )

        # Create new code mapping with new integration
        # Use different project to avoid unique constraint
        project_web = self.create_project(organization=self.organization)

        repo_web = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=integration_with_web.id,
            config={"depot_path": "//depot"},
        )

        org_integration = integration_with_web.organizationintegration_set.first()
        assert org_integration is not None
        code_mapping_web = RepositoryProjectPathConfig.objects.create(
            project=project_web,
            organization_id=self.organization.id,
            repository=repo_web,
            organization_integration_id=org_integration.id,
            integration_id=integration_with_web.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        ctx: StacktraceLinkContext = {
            "file": "depot/app/services/processor.py",
            "filename": "depot/app/services/processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([code_mapping_web], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        # Swarm format uses /files/ prefix
        assert (
            "https://p4web.example.com/files//depot/app/services/processor.py"
            in result["source_url"]
        )

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_abs_path_fallback(self, mock_check_file):
        """Test stacktrace link uses abs_path when filename is just basename"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.py"}
        ctx: StacktraceLinkContext = {
            "file": "processor.py",
            "filename": "processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        assert "//depot/app/services/processor.py" in result["source_url"]
        assert result["src_path"] == "app/services/processor.py"

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_iteration_count(self, mock_check_file):
        """Test that iteration_count is incremented only for matching mappings"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.py"}
        # Add a non-matching mapping
        other_repo = Repository.objects.create(
            name="//other",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//other"},
        )

        other_mapping = RepositoryProjectPathConfig.objects.create(
            project=self.project,
            organization_id=self.organization.id,
            repository=other_repo,
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="other/",
            source_root="/",
            default_branch=None,
        )

        ctx: StacktraceLinkContext = {
            "file": "depot/app/services/processor.py",
            "filename": "depot/app/services/processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([other_mapping, self.code_mapping], ctx)

        # iteration_count should be 1 (only depot mapping matched)
        assert result["iteration_count"] == 1
        assert result["source_url"] is not None

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_config_stops_on_first_match(self, mock_check_file):
        """Test that iteration stops after first successful match"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.py"}
        # Add another depot mapping (shouldn't be checked if first matches)
        # Use different project to avoid unique constraint
        project2 = self.create_project(organization=self.organization)

        myproject_repo = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//myproject"},
        )

        myproject_mapping = RepositoryProjectPathConfig.objects.create(
            project=project2,
            organization_id=self.organization.id,
            repository=myproject_repo,
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="depot/",  # Same stack_root as depot mapping (but different project)
            source_root="/",
            default_branch=None,
        )

        ctx: StacktraceLinkContext = {
            "file": "depot/app/services/processor.py",
            "filename": "depot/app/services/processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([self.code_mapping, myproject_mapping], ctx)

        # Should stop after first match (depot mapping)
        assert result["iteration_count"] == 1
        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        assert "//depot/app/services/processor.py" in result["source_url"]


class PerforceStacktraceLinkEdgeCasesTest(IntegrationTestCase):
    """Edge case tests for Perforce stacktrace links"""

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
        self.project = self.create_project(organization=self.organization)

        # Mock the Perforce client's check_file to avoid actual P4 connection
        self.check_file_patcher = patch(
            "sentry.integrations.perforce.client.PerforceClient.check_file",
            return_value={"depotFile": "//depot/mock"},
        )
        self.check_file_patcher.start()

    def tearDown(self):
        self.check_file_patcher.stop()
        super().tearDown()

    def test_stacktrace_link_empty_stack_root(self):
        """Test stacktrace link with empty stack_root (shouldn't match anything)"""
        self.check_file_patcher.stop()
        self.check_file_patcher = patch(
            "sentry.integrations.perforce.client.PerforceClient.check_file",
            return_value={"depotFile": "//depot/app/services/processor.py"},
        )
        self.check_file_patcher.start()
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
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="",
            source_root="/",
            default_branch=None,
        )

        ctx: StacktraceLinkContext = {
            "file": "depot/app/services/processor.py",
            "filename": "depot/app/services/processor.py",
            "abs_path": "depot/app/services/processor.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([code_mapping], ctx)

        # Empty stack_root should match any path
        assert result["source_url"] is not None

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_stacktrace_link_with_special_characters_in_path(self, mock_check_file):
        """Test stacktrace link with special characters in file path"""
        mock_check_file.return_value = {"depotFile": "//depot/app/my services/processor-v2.py"}
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
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        # Path with spaces and special chars
        ctx: StacktraceLinkContext = {
            "file": "depot/app/my services/processor-v2.py",
            "filename": "depot/app/my services/processor-v2.py",
            "abs_path": "depot/app/my services/processor-v2.py",
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([code_mapping], ctx)

        assert result["source_url"] is not None
        assert result["src_path"] == "app/my services/processor-v2.py"

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_stacktrace_link_deeply_nested_path(self, mock_check_file):
        """Test stacktrace link with very deeply nested path"""
        mock_check_file.return_value = {"depotFile": "//depot/file.py"}
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
            organization_integration_id=self.integration.organizationintegration_set.first().id,
            integration_id=self.integration.id,
            stack_root="depot/",
            source_root="/",
            default_branch=None,
        )

        deep_path = "depot/" + "/".join([f"level{i}" for i in range(20)]) + "/file.py"

        ctx: StacktraceLinkContext = {
            "file": deep_path,
            "filename": deep_path,
            "abs_path": deep_path,
            "platform": "python",
            "sdk_name": "sentry.python",
            "commit_id": None,
            "group_id": None,
            "line_no": None,
            "module": None,
            "package": None,
        }

        result = get_stacktrace_config([code_mapping], ctx)

        assert result["source_url"] is not None
        assert isinstance(result["source_url"], str)
        assert "//depot/" in result["source_url"]
