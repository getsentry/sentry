import contextlib
from datetime import UTC, datetime
from unittest.mock import MagicMock, Mock, patch

from requests import HTTPError

from sentry.constants import ObjectStatus
from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
)
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentProviderType,
    CodingAgentState,
    CodingAgentStatus,
)
from sentry.seer.models import PreferenceResponse, SeerRepoDefinition
from sentry.testutils.cases import APITestCase


class MockCodingAgentProvider(CodingAgentIntegrationProvider):
    """Mock coding agent provider for tests."""

    key = "mock_agent"
    name = "Mock Agent"

    def get_agent_name(self) -> str:
        return "Mock Agent"

    def get_agent_key(self) -> str:
        return "mock_agent"

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        return {
            "external_id": "mock_agent",
            "name": "Mock Agent",
            "metadata": {"api_key": "test_key"},
        }


class MockCodingAgentInstallation(CodingAgentIntegration):
    """Mock coding agent installation for tests."""

    def get_client(self):
        return MockCodingAgentClient()

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        return CodingAgentState(
            id="mock-123",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Mock Agent",
            started_at=datetime.now(UTC),
        )


class MockCodingAgentClient(CodingAgentClient):
    """Mock coding agent client for tests."""

    base_url = "https://api.mock-agent.com/v1"

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Mock implementation of launch method."""
        return CodingAgentState(
            id="mock-123",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Mock Agent",
            started_at=datetime.now(UTC),
        )


class BaseOrganizationCodingAgentsTest(APITestCase):
    """Base test class with common setup for coding agent endpoint tests."""

    endpoint = "sentry-api-0-organization-coding-agents"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self._setup_mock_integration()

    def _setup_mock_integration(self):
        """Set up mock integration and related objects for testing."""
        # Mock the coding agent providers to include our mock provider
        self.mock_provider = MockCodingAgentProvider()

        # Create a GitHub integration to use as our test integration
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:123",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "github.com",
            },
        )

        # Create proper RPC objects using serialization
        self.rpc_integration = serialize_integration(self.integration)

        # Get the organization integration and serialize it using the integration service
        from sentry.integrations.services.integration import integration_service

        org_integration = integration_service.get_organization_integration(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        self.rpc_org_integration = org_integration

        # Create mock installation
        self.mock_installation = MockCodingAgentInstallation(self.integration, self.organization.id)

    def _create_mock_rpc_integration(self):
        """Create a mock RPC integration for testing."""
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.name = self.integration.name
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.metadata = self.integration.metadata
        mock_rpc_integration.get_installation = MagicMock(return_value=self.mock_installation)
        return mock_rpc_integration

    def _create_mock_autofix_state(self, repos=None):
        """Create a mock autofix state for testing."""
        if repos is None:
            repos = [
                SeerRepoDefinition(
                    organization_id=self.organization.id,
                    integration_id=str(self.integration.id),
                    owner="test",
                    name="repo",
                    external_id="123",
                    provider="github",
                )
            ]

        return AutofixState.validate(
            {
                "run_id": 123,
                "updated_at": datetime.now(UTC),
                "status": AutofixStatus.PROCESSING,
                "request": {
                    "organization_id": self.organization.id,
                    "project_id": self.project.id,
                    "repos": repos,
                    "issue": {"id": 123, "title": "Test Issue"},
                },
                "steps": [
                    {
                        "key": "solution",
                        "solution": [
                            {"relevant_code_file": {"repo_name": "owner1/repo1"}},
                            {"relevant_code_file": {"repo_name": "owner2/repo2"}},
                        ],
                    }
                ],
            }
        )

    def mock_integration_service_calls(self, integrations=None):
        """Helper to mock integration service calls for GET endpoint."""
        from unittest.mock import patch

        from sentry.integrations.services.integration import integration_service

        integrations = integrations or []

        @contextlib.contextmanager
        def mock_context():
            with (
                patch.object(
                    integration_service,
                    "get_integrations",
                    return_value=integrations,
                ),
                patch(
                    "sentry.seer.autofix.coding_agent.get_coding_agent_providers",
                    return_value=["test_provider"],
                ),
            ):
                yield

        return mock_context()


class StoreCodingAgentStatesToSeerTest(APITestCase):
    def test_batch_function_posts_correct_payload(self):
        from datetime import UTC, datetime
        from unittest.mock import MagicMock, patch

        import orjson

        from sentry.seer.autofix.coding_agent import store_coding_agent_states_to_seer
        from sentry.seer.autofix.utils import (
            CodingAgentProviderType,
            CodingAgentState,
            CodingAgentStatus,
        )

        state1 = CodingAgentState(
            id="a1",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Agent 1",
            started_at=datetime.now(UTC),
        )
        state2 = CodingAgentState(
            id="a2",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Agent 2",
            started_at=datetime.now(UTC),
        )

        mocked_response = MagicMock()
        mocked_response.status = 200
        mocked_response.data = b"{}"

        with patch(
            "sentry.seer.autofix.coding_agent.make_signed_seer_api_request",
            return_value=mocked_response,
        ) as mocked_call:
            store_coding_agent_states_to_seer(run_id=5, coding_agent_states=[state1, state2])

            mocked_call.assert_called_once()
            args, kwargs = mocked_call.call_args
            # path is the second positional arg
            assert args[1] == "/v1/automation/autofix/coding-agent/state/set"
            body = orjson.loads(kwargs["body"]) if "body" in kwargs else orjson.loads(args[2])
            assert body["run_id"] == 5
            assert isinstance(body["coding_agent_states"], list)
            assert len(body["coding_agent_states"]) == 2
            ids = {s["id"] for s in body["coding_agent_states"]}
            assert ids == {"a1", "a2"}


class OrganizationCodingAgentsGetTest(BaseOrganizationCodingAgentsTest):
    """Test class for GET endpoint functionality."""

    def test_feature_flag_disabled(self):
        """Test GET request when feature flag is disabled."""
        organization = self.create_organization(owner=self.user)

        with self.feature({"organizations:seer-coding-agent-integrations": False}):
            response = self.get_response(organization.slug)

        assert response.status_code == 404
        assert response.data["detail"] == "Feature not available"

    def test_no_integrations(self):
        """Test GET request with no coding agent integrations."""
        organization = self.create_organization(owner=self.user)

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        assert response.data["integrations"] == []

    def test_with_mock_integration(self):
        """Test GET request with mocked coding agent integration."""
        organization = self.create_organization(owner=self.user)

        mock_integration = Mock()
        mock_integration.id = 1
        mock_integration.name = "Test Coding Agent"
        mock_integration.provider = "test_provider"

        with (
            self.feature({"organizations:seer-coding-agent-integrations": True}),
            self.mock_integration_service_calls(integrations=[mock_integration]),
        ):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        integrations = response.data["integrations"]
        assert len(integrations) == 1

        integration_data = integrations[0]
        assert integration_data["id"] == "1"
        assert integration_data["name"] == "Test Coding Agent"
        assert integration_data["provider"] == "test_provider"

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_returns_coding_agent_integrations(self, mock_get_integrations):
        """Test GET endpoint returns coding agent integrations."""
        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.name = "GitHub"
        mock_integration.provider = "github"
        mock_get_integrations.return_value = [mock_integration]

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug)

            assert "integrations" in response.data
            integrations = response.data["integrations"]
            assert len(integrations) == 1
            integration_data = integrations[0]

            # The endpoint only returns basic integration data
            assert integration_data["id"] == str(self.integration.id)
            assert integration_data["name"] == "GitHub"
            assert integration_data["provider"] == "github"

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_handles_integration_processing_error(self, mock_get_integrations):
        """Test GET endpoint handles empty integrations gracefully."""
        mock_get_integrations.return_value = []

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug)

            assert "integrations" in response.data
            assert len(response.data["integrations"]) == 0

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_handles_service_error(self, mock_get_integrations):
        """Test GET endpoint handles organization integrations service errors."""
        # Mock service to raise an exception
        mock_get_integrations.side_effect = Exception("Service unavailable")

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(self.organization.slug, status_code=500)
            assert response.status_code == 500

    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integrations"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_handles_integration_not_found(self, mock_get_integration, mock_get_org_integrations):
        """Test GET endpoint handles case where integration is not found."""
        # Mock organization integrations but integration lookup returns None
        mock_get_org_integrations.return_value = [self.rpc_org_integration]
        mock_get_integration.return_value = None

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug)

            # Should skip integrations that can't be found
            assert "integrations" in response.data
            assert len(response.data["integrations"]) == 0


class OrganizationCodingAgentsPostParameterValidationTest(BaseOrganizationCodingAgentsTest):
    """Test class for POST endpoint parameter validation."""

    def test_feature_flag_disabled(self):
        """Test POST endpoint when feature flag is disabled."""
        data = {"integration_id": "123", "run_id": 123}
        response = self.get_error_response(
            self.organization.slug, method="post", status_code=403, **data
        )
        # POST returns plain string for disabled feature (403 PermissionDenied)
        assert response.data["detail"] == "Feature not available"

    def test_missing_integration_id(self):
        """Test POST endpoint with missing integration_id."""
        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400
            )
            # Serializer returns field error mapping
            assert "integration_id" in response.data
            assert "run_id" in response.data

    def test_invalid_integration_id(self):
        """Test POST endpoint with invalid integration_id."""
        data = {"integration_id": "invalid_id"}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert "integration_id" in response.data

    def test_non_coding_agent_integration(self):
        """Test POST endpoint with non-coding agent integration."""
        # Create a non-coding agent integration (e.g., Slack)
        slack_integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack",
            external_id="slack:123",
        )

        data = {"integration_id": str(slack_integration.id), "run_id": 123}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            # DRF ValidationError returns a list for non-field errors
            assert response.data[0] == "Not a coding agent integration"

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    def test_integration_not_found(self, mock_get_org_integration, mock_get_providers):
        """Test POST endpoint with integration that doesn't exist."""
        mock_get_providers.return_value = ["github"]
        mock_get_org_integration.return_value = None

        data = {"integration_id": "999", "run_id": 123}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=404, **data
            )
            assert response.data["detail"] == "Integration not found"

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    def test_inactive_integration(self, mock_get_org_integration, mock_get_providers):
        """Test POST endpoint with inactive integration."""
        mock_get_providers.return_value = ["github"]

        # Create inactive organization integration
        inactive_org_integration = MagicMock()
        inactive_org_integration.status = ObjectStatus.PENDING_DELETION
        mock_get_org_integration.return_value = inactive_org_integration

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=404, **data
            )
            assert response.data["detail"] == "Integration not found"

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_empty_run_id(self, mock_get_integration, mock_get_org_integration, mock_get_providers):
        """Test POST endpoint with empty run_id."""
        mock_get_providers.return_value = ["github"]
        mock_get_org_integration.return_value = self.rpc_org_integration

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_integration.return_value = mock_rpc_integration

        data = {"integration_id": str(self.integration.id), "run_id": ""}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert "run_id" in response.data

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_null_run_id(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_providers,
    ):
        """Test POST endpoint with null run_id."""
        mock_get_providers.return_value = ["github"]
        mock_get_org_integration.return_value = self.rpc_org_integration

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_integration.return_value = mock_rpc_integration

        data = {"integration_id": str(self.integration.id), "run_id": None}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert "run_id" in response.data

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_string_run_id(
        self, mock_get_integration, mock_get_org_integration, mock_get_providers
    ):
        """Test POST endpoint with non-numeric run_id."""
        mock_get_providers.return_value = ["github"]
        mock_get_org_integration.return_value = self.rpc_org_integration

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_integration.return_value = mock_rpc_integration

        data = {"integration_id": str(self.integration.id), "run_id": "not_a_number"}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert "run_id" in response.data

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_invalid_coding_agent_installation(
        self, mock_get_integration, mock_get_org_integration, mock_get_providers
    ):
        """Test POST endpoint when installation is not a CodingAgentIntegration."""
        mock_get_providers.return_value = ["github"]
        mock_get_org_integration.return_value = self.rpc_org_integration

        # Mock integration that returns non-CodingAgentIntegration
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.get_installation.return_value = (
            MagicMock()
        )  # Not CodingAgentIntegration
        mock_get_integration.return_value = mock_rpc_integration

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            # DRF ValidationError returns a list for non-field errors
            assert response.data[0] == "Invalid coding agent integration"


class OrganizationCodingAgentsPostLaunchTest(BaseOrganizationCodingAgentsTest):
    """Test class for POST endpoint launch functionality."""

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launches_coding_agent(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint launches coding agent."""
        # Mock coding agent providers to include github
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test coding agent prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0

            # Verify prompt was called with default trigger_source and no instruction
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.SOLUTION, None)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_all_parameters(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with all launch parameters."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt for all parameters"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_handles_launch_exception(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint handles launch exceptions."""
        mock_get_providers.return_value = ["github"]

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Mock get_autofix_state to return None (no state found)
        mock_get_autofix_state.return_value = None

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=404, **data
            )
            # POST returns 404 NotFound for this error path
            assert response.data["detail"] == "Autofix state not found"

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_multi_repo_launch(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint launches agents for multiple repositories."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Multi-repo test prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        multi_repo_list = [
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner1",
                name="repo1",
                external_id="123",
                provider="github",
            ),
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner2",
                name="repo2",
                external_id="456",
                provider="github",
            ),
        ]
        mock_autofix_state = self._create_mock_autofix_state(repos=multi_repo_list)
        mock_autofix_state.steps = [
            {
                "key": "solution",
                "solution": [
                    {"relevant_code_file": {"repo_name": "owner1/repo1"}},
                    {"relevant_code_file": {"repo_name": "owner2/repo2"}},
                ],
            }
        ]
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_repo_launch_error_continues_with_others(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint continues with other repos when one repo fails."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt for repo launch error"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        # Create mock installation that fails for first repo
        failing_installation = MagicMock(spec=MockCodingAgentInstallation)
        failing_installation.launch.side_effect = [
            HTTPError("Repository not accessible"),  # First call fails
            CodingAgentState(  # Second call succeeds
                id="success-123",
                status=CodingAgentStatus.PENDING,
                provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                name="Success Agent",
                started_at=datetime.now(UTC),
            ),
        ]

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_rpc_integration.get_installation = MagicMock(return_value=failing_installation)

        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        multi_repo_list = [
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner1",
                name="repo1",
                external_id="123",
                provider="github",
            ),
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner2",
                name="repo2",
                external_id="456",
                provider="github",
            ),
        ]
        mock_autofix_state = self._create_mock_autofix_state(repos=multi_repo_list)
        mock_autofix_state.steps = [
            {
                "key": "solution",
                "solution": [
                    {"relevant_code_file": {"repo_name": "owner1/repo1"}},
                    {"relevant_code_file": {"repo_name": "owner2/repo2"}},
                ],
            }
        ]
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            # Should succeed because at least one repo launched successfully
            assert response.data["success"] is True
            assert response.data["launched_count"] == 1
            assert response.data["failed_count"] == 1
            # Should have failure details
            assert "failures" in response.data
            assert len(response.data["failures"]) == 1
            # One of the two repos should have failed
            assert response.data["failures"][0]["repo_name"] in ["owner1/repo1", "owner2/repo2"]
            assert "error_message" in response.data["failures"][0]

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_all_repos_fail_returns_failures(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint returns failures when all repos fail to launch."""
        mock_get_providers.return_value = ["github"]
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        # Create mock installation that always fails
        failing_installation = MagicMock(spec=MockCodingAgentInstallation)
        failing_installation.launch.side_effect = HTTPError("Whoops!")

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_rpc_integration.get_installation = MagicMock(return_value=failing_installation)

        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_prompt.return_value = "oh hi"

        # Create multi-repo autofix state
        multi_repo_list = [
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner1",
                name="repo1",
                external_id="123",
                provider="github",
            ),
            SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id=str(self.integration.id),
                owner="owner2",
                name="repo2",
                external_id="456",
                provider="github",
            ),
        ]
        mock_autofix_state = self._create_mock_autofix_state(repos=multi_repo_list)
        mock_autofix_state.steps = [
            {
                "key": "solution",
                "solution": [
                    {"relevant_code_file": {"repo_name": "owner1/repo1"}},
                    {"relevant_code_file": {"repo_name": "owner2/repo2"}},
                ],
            }
        ]
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            # Should succeed but with all failures
            assert response.data["success"] is True
            assert response.data["launched_count"] == 0
            assert response.data["failed_count"] == 2
            # Should have failure details
            assert "failures" in response.data
            assert len(response.data["failures"]) == 2
            # Check both repos failed
            failed_repos = {f["repo_name"] for f in response.data["failures"]}
            assert failed_repos == {"owner1/repo1", "owner2/repo2"}
            # Each failure should have an error message
            for failure in response.data["failures"]:
                assert "error_message" in failure
                assert failure["error_message"] != ""

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    def test_seer_storage_failure_continues(
        self,
        mock_store_to_seer,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint continues when Seer storage fails."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt for seer storage failure"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )
        mock_store_to_seer.return_value = False  # Simulate Seer storage failure

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            # Should still succeed even if Seer storage fails
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0
            # Verify Seer storage was attempted once in batch
            mock_store_to_seer.assert_called_once()


class OrganizationCodingAgentsPostTriggerSourceTest(BaseOrganizationCodingAgentsTest):
    """Test class for POST endpoint trigger source functionality."""

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_root_cause_trigger_source(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with root_cause trigger_source."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Root cause prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "root_cause",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0

            # Verify prompt was called with root_cause trigger_source and no instruction
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.ROOT_CAUSE, None)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_root_cause_repos_extracted_and_deduped(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Root cause repos are extracted, de-duplicated, and used for launch."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Root cause prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Create autofix state with request repos and root cause step including duplicate repos
        mock_autofix_state = self._create_mock_autofix_state(
            repos=[
                SeerRepoDefinition(
                    organization_id=self.organization.id,
                    integration_id=str(self.integration.id),
                    owner="owner1",
                    name="repo1",
                    external_id="123",
                    provider="github",
                ),
                SeerRepoDefinition(
                    organization_id=self.organization.id,
                    integration_id=str(self.integration.id),
                    owner="owner2",
                    name="repo2",
                    external_id="456",
                    provider="github",
                ),
            ]
        )
        mock_autofix_state.steps = [
            {
                "key": "root_cause_analysis",
                "causes": [
                    {
                        "description": "Something happened",
                        "relevant_repos": ["owner1/repo1", "owner1/repo1"],
                    }
                ],
            }
        ]
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "root_cause",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.ROOT_CAUSE, None)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_root_cause_without_relevant_repos_falls_back_to_request_repos(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """If root cause has no relevant_repos, fallback to request repos path executes."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Root cause prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Create autofix state with request repos and root cause step lacking relevant_repos field
        mock_autofix_state = self._create_mock_autofix_state(
            repos=[
                SeerRepoDefinition(
                    organization_id=self.organization.id,
                    integration_id=str(self.integration.id),
                    owner="owner1",
                    name="repo1",
                    external_id="123",
                    provider="github",
                ),
            ]
        )
        mock_autofix_state.steps = [
            {
                "key": "root_cause_analysis",
                "causes": [
                    {
                        "description": "Something happened",
                        # intentionally no 'relevant_repos'
                    }
                ],
            }
        ]
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "root_cause",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.ROOT_CAUSE, None)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_solution_trigger_source(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with solution trigger_source."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Solution prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "solution",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0

            # Verify prompt was called with solution trigger_source and no instruction
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.SOLUTION, None)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_invalid_trigger_source(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with invalid trigger_source."""
        mock_get_providers.return_value = ["github"]

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "invalid_source",
        }

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            # Serializer field error shape
            assert "trigger_source" in response.data

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_prompt_not_available(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint when prompt is not available."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = None  # Prompt not available
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "solution",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.get_coding_agent_prompt",
                return_value=None,
            ),
        ):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=500, **data
            )
            assert response.data["detail"] == "Issue fetching prompt to send to coding agents."


class OrganizationCodingAgentsPostInstructionTest(BaseOrganizationCodingAgentsTest):
    """Test class for POST endpoint instruction parameter functionality."""

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_custom_instruction(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with custom instruction."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt with custom instruction"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "instruction": "Use TypeScript instead of JavaScript",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True
            assert response.data["launched_count"] >= 0
            assert response.data["failed_count"] >= 0

            # Verify prompt was called with the instruction
            mock_get_prompt.assert_called_with(
                123, AutofixTriggerSource.SOLUTION, "Use TypeScript instead of JavaScript"
            )

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_blank_instruction(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with blank instruction gets trimmed to empty string."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt without instruction"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "instruction": "   ",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

            # CharField trims whitespace by default, so blank instruction becomes empty string
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.SOLUTION, "")

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_empty_instruction(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with empty instruction."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "instruction": "",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

            # Verify prompt was called with empty string instruction
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.SOLUTION, "")

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_max_length_instruction(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with max length instruction."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Test prompt with long instruction"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        # Create instruction at max length (4096 characters)
        long_instruction = "a" * 4096

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "instruction": long_instruction,
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

            # Verify prompt was called with the long instruction
            mock_get_prompt.assert_called_with(123, AutofixTriggerSource.SOLUTION, long_instruction)

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_too_long_instruction(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_providers,
    ):
        """Test POST endpoint with instruction exceeding max length."""
        mock_get_providers.return_value = ["github"]

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Create instruction exceeding max length (4096 + 1 characters)
        too_long_instruction = "a" * 4097

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "instruction": too_long_instruction,
        }

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            # Serializer should return field error
            assert "instruction" in response.data

    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_providers")
    @patch("sentry.seer.autofix.coding_agent.get_autofix_state")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_launch_with_instruction_and_root_cause_trigger(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_preferences,
        mock_get_prompt,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with custom instruction and root_cause trigger."""
        mock_get_providers.return_value = ["github"]
        mock_get_prompt.return_value = "Root cause prompt with instruction"
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        mock_rpc_integration = self._create_mock_rpc_integration()
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration
        mock_get_autofix_state.return_value = self._create_mock_autofix_state()

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
            "trigger_source": "root_cause",
            "instruction": "Focus on the database queries",
        }

        with (
            self.feature("organizations:seer-coding-agent-integrations"),
            patch(
                "sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer",
            ),
        ):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

            # Verify prompt was called with both trigger_source and instruction
            mock_get_prompt.assert_called_with(
                123, AutofixTriggerSource.ROOT_CAUSE, "Focus on the database queries"
            )
