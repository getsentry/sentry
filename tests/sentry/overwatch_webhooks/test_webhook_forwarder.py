from unittest.mock import MagicMock, patch

from sentry.models.organization import Organization
from sentry.overwatch_webhooks.models import OrganizationSummary, WebhookDetails
from sentry.overwatch_webhooks.webhook_forwarder import (
    GITHUB_EVENTS_TO_FORWARD_OVERWATCH,
    OverwatchGithubWebhookForwarder,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test


@control_silo_test()
class OverwatchGithubWebhookForwarderTest(TestCase):
    def setUp(self):
        self.integration = self.create_integration(
            provider="github",
            external_id="12345",
            name="Test Integration",
            organization=self.organization,
        )
        self.forwarder = OverwatchGithubWebhookForwarder(self.integration)

    def _set_organization_consent(self, organization, has_consent=True):
        """Helper to set organization AI consent options."""
        with assume_test_silo_mode_of(Organization):
            if has_consent:
                # Enable PR review test generation and don't hide AI features
                organization.update_option("sentry:enable_pr_review_test_generation", True)
                organization.update_option("sentry:hide_ai_features", False)
            else:
                # Disable PR review test generation or hide AI features
                organization.update_option("sentry:enable_pr_review_test_generation", False)
                organization.update_option("sentry:hide_ai_features", True)

    def _create_organization_with_consent(self, name, slug, has_consent=True):
        """Helper to create an organization with specified consent status."""
        organization = self.create_organization(name=name, slug=slug)
        self._set_organization_consent(organization, has_consent)
        return organization

    def test_init_creates_publisher_with_correct_provider(self):
        """Test that initialization creates publisher with correct integration provider."""
        assert self.forwarder.integration == self.integration
        assert self.forwarder.publisher._integration_provider == "github"

    def test_should_forward_to_overwatch_with_valid_events(self):
        """Test that should_forward_to_overwatch returns True for valid events."""
        for event_action in GITHUB_EVENTS_TO_FORWARD_OVERWATCH:
            event = {"action": event_action}
            assert self.forwarder.should_forward_to_overwatch(event) is True

    def test_should_forward_to_overwatch_with_invalid_events(self):
        """Test that should_forward_to_overwatch returns False for invalid events."""
        invalid_events = [
            {"action": "invalid_action"},
            {"action": "create"},
            {"action": "delete"},
            {"action": "some_other_action"},
            {},  # No action key
        ]

        for event in invalid_events:
            assert self.forwarder.should_forward_to_overwatch(event) is False

    def test_get_organizations_with_consent_no_org_integrations(self):
        """Test get_organizations_with_consent returns empty list when no org integrations exist."""
        orgs = self.forwarder.get_organizations_with_consent(self.integration)
        assert orgs == []

    def test_get_organizations_with_consent_no_consent(self):
        """Test get_organizations_with_consent returns empty list when organizations don't have consent."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=False
        )
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        orgs = self.forwarder.get_organizations_with_consent(self.integration)
        assert orgs == []

    def test_get_organizations_with_consent_with_consent(self):
        """Test get_organizations_with_consent returns organizations that have consent."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=True
        )
        org_integration = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        orgs = self.forwarder.get_organizations_with_consent(self.integration)

        assert len(orgs) == 1
        assert isinstance(orgs[0], OrganizationSummary)
        assert orgs[0].name == "Test Org"
        assert orgs[0].slug == "test-org"
        assert orgs[0].id == organization.id
        assert orgs[0].github_integration_id == self.integration.id
        assert orgs[0].organization_integration_id == org_integration.id

    def test_get_organizations_with_consent_multiple_orgs_mixed_consent(self):
        # Org with consent
        org1 = self._create_organization_with_consent(name="Org 1", slug="org-1", has_consent=True)
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org1.id,
        )

        # Another org with consent
        org2 = self._create_organization_with_consent(name="Org 2", slug="org-2", has_consent=True)
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org2.id,
        )

        # Organization without consent
        org3 = self._create_organization_with_consent(name="Org 3", slug="org-3", has_consent=False)
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org3.id,
        )

        orgs = self.forwarder.get_organizations_with_consent(self.integration)
        assert len(orgs) == 2
        org_slugs = {org.slug for org in orgs}
        assert org_slugs == {"org-1", "org-2"}

        # Verify org3 is not included
        assert "org-3" not in org_slugs

    def test_forward_if_applicable_no_organizations_with_consent(self):
        """Test forward_if_applicable does nothing when no organizations have consent."""
        event = {"action": "push", "data": "test"}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)
            mock_enqueue.assert_not_called()

    def test_forward_if_applicable_event_not_eligible_for_forwarding(self):
        """Test forward_if_applicable does nothing when event is not eligible for forwarding."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=True
        )
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        # Event with invalid action
        event = {"action": "invalid_action", "data": "test"}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)
            mock_enqueue.assert_not_called()

    def test_forward_if_applicable_successful_forwarding(self):
        """Test forward_if_applicable successfully forwards webhook when conditions are met."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=True
        )
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        event = {"action": "pull_request", "repository": "test-repo", "commits": []}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            # Verify WebhookDetails structure
            assert isinstance(call_args, WebhookDetails)
            assert len(call_args.organizations) == 1
            assert call_args.organizations[0].name == "Test Org"
            assert call_args.webhook_body == event

    def test_forward_if_applicable_multiple_organizations(self):
        """Test forward_if_applicable forwards webhook for multiple organizations with consent."""
        # Create multiple organizations with consent
        for i in range(3):
            org = self._create_organization_with_consent(
                name=f"Org {i+1}", slug=f"org-{i+1}", has_consent=True
            )
            self.create_organization_integration(
                integration=self.integration,
                organization_id=org.id,
            )

        event = {"action": "pull_request", "number": 123}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            # Verify all organizations are included
            assert isinstance(call_args, WebhookDetails)
            assert len(call_args.organizations) == 3
            org_names = {org.slug for org in call_args.organizations}
            assert org_names == {"org-1", "org-2", "org-3"}
            assert call_args.webhook_body == event

    @patch("sentry.overwatch_webhooks.webhook_forwarder.OverwatchWebhookPublisher")
    def test_publisher_initialization_with_mocked_publisher(self, mock_publisher_class):
        """Test that publisher is initialized correctly with mocked publisher."""
        mock_publisher_instance = MagicMock()
        mock_publisher_class.return_value = mock_publisher_instance

        forwarder = OverwatchGithubWebhookForwarder(self.integration)

        mock_publisher_class.assert_called_once_with(integration_provider="github")
        assert forwarder.publisher == mock_publisher_instance

    def test_forward_if_applicable_all_valid_event_actions(self):
        """Test forward_if_applicable works for all valid event actions."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=True
        )
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        # Test each valid event action
        for action in GITHUB_EVENTS_TO_FORWARD_OVERWATCH:
            event = {"action": action, "test_data": f"data_for_{action}"}

            with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
                self.forwarder.forward_if_applicable(event)
                mock_enqueue.assert_called_once()

                call_args = mock_enqueue.call_args[0][0]
                assert isinstance(call_args, WebhookDetails)
                assert call_args.webhook_body == event

    def test_forward_if_applicable_preserves_webhook_body_data(self):
        """Test that forward_if_applicable preserves all webhook body data."""
        organization = self._create_organization_with_consent(
            name="Test Org", slug="test-org", has_consent=True
        )
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        complex_event = {
            "action": "pull_request",
            "repository": {"id": 123, "name": "test-repo", "full_name": "user/test-repo"},
            "commits": [
                {
                    "id": "abc123",
                    "message": "Test commit",
                    "author": {"name": "Test User", "email": "test@example.com"},
                }
            ],
            "head_commit": {"id": "abc123", "tree_id": "def456", "distinct": True},
            "pusher": {"name": "Test User", "email": "test@example.com"},
            "sender": {"login": "testuser", "id": 456},
        }

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(complex_event)

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            # Verify complete webhook body is preserved
            assert isinstance(call_args, WebhookDetails)
            assert call_args.webhook_body == complex_event
            assert call_args.webhook_body["repository"]["name"] == "test-repo"
            assert len(call_args.webhook_body["commits"]) == 1
            assert call_args.webhook_body["commits"][0]["id"] == "abc123"
