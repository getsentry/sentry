from unittest.mock import MagicMock, patch

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.overwatch_webhooks.consent_checks import (
    EVENTS_TO_FORWARD_OVERWATCH,
    OverwatchGithubWebhookForwarder,
)
from sentry.overwatch_webhooks.models import OrganizationSummary, WebhookDetails
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
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

    def test_init_creates_publisher_with_correct_provider(self):
        """Test that initialization creates publisher with correct integration provider."""
        assert self.forwarder.integration == self.integration
        assert self.forwarder.publisher._integration_provider == "github"

    def test_should_forward_to_overwatch_with_valid_events(self):
        """Test that should_forward_to_overwatch returns True for valid events."""
        for event_action in EVENTS_TO_FORWARD_OVERWATCH:
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

    def test_get_organizations_with_consent_no_codecov_access(self):
        """Test get_organizations_with_consent returns empty list when organizations don't have codecov access."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        orgs = self.forwarder.get_organizations_with_consent(self.integration)
        assert orgs == []

    def test_get_organizations_with_consent_with_codecov_access(self):
        """Test get_organizations_with_consent returns organizations that have codecov access."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        org_integration = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        with assume_test_silo_mode_of(Organization):
            organization.flags.codecov_access = True
            organization.save()

        orgs = self.forwarder.get_organizations_with_consent(self.integration)

        assert len(orgs) == 1
        assert isinstance(orgs[0], OrganizationSummary)
        assert orgs[0].name == "Test Org"
        assert orgs[0].slug == "test-org"
        assert orgs[0].id == organization.id
        assert orgs[0].github_integration_id == self.integration.id
        assert orgs[0].organization_integration_id == org_integration.id

    def test_get_organizations_with_consent_multiple_orgs_mixed_consent(self):
        org1 = self.create_organization(name="Org 1", slug="org-1")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org1.id,
        )

        # US Org with consent
        with assume_test_silo_mode_of(Organization):
            org1.flags.codecov_access = True
            org1.save()

        # DE Org with consent
        org2 = self.create_organization(name="Org 2", slug="org-2")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org2.id,
        )

        with assume_test_silo_mode_of(Organization):
            org2.flags.codecov_access = True
            org2.save()

        # Organization without consent
        org3 = self.create_organization(name="Org 3", slug="org-3")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=org3.id,
        )
        with assume_test_silo_mode_of(Organization):
            org3.flags.codecov_access = False
            org3.save()

        with outbox_runner():
            pass

        with assume_test_silo_mode_of(Organization):
            org3.refresh_from_db()
            assert bool(org3.flags.codecov_access) is False
        assert OrganizationMapping.objects.get(organization_id=org3.id).codecov_access is False

        with assume_test_silo_mode_of(Organization):
            org2.refresh_from_db()
            assert bool(org2.flags.codecov_access) is True
        assert OrganizationMapping.objects.get(organization_id=org2.id).codecov_access is True

        with assume_test_silo_mode_of(Organization):
            org1.refresh_from_db()
            assert bool(org1.flags.codecov_access) is True
        assert OrganizationMapping.objects.get(organization_id=org1.id).codecov_access is True

        orgs = self.forwarder.get_organizations_with_consent(self.integration)
        assert len(orgs) == 2
        org_names = {org.slug for org in orgs}
        assert org_names == {"org-1", "org-2"}

        # Verify org2 is not included
        assert "Org 2" not in org_names

    def test_forward_if_applicable_no_organizations_with_consent(self):
        """Test forward_if_applicable does nothing when no organizations have consent."""
        event = {"action": "push", "data": "test"}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)
            mock_enqueue.assert_not_called()

    def test_forward_if_applicable_event_not_eligible_for_forwarding(self):
        """Test forward_if_applicable does nothing when event is not eligible for forwarding."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        with assume_test_silo_mode_of(Organization):
            organization.flags.codecov_access = True
            organization.save()

        # Event with invalid action
        event = {"action": "invalid_action", "data": "test"}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)
            mock_enqueue.assert_not_called()

    def test_forward_if_applicable_successful_forwarding(self):
        """Test forward_if_applicable successfully forwards webhook when conditions are met."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        with assume_test_silo_mode_of(Organization):
            organization.flags.codecov_access = True
            organization.save()

        event = {"action": "push", "repository": "test-repo", "commits": []}

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
        organizations = []
        org_integrations = []
        org_mappings = []

        for i in range(3):
            org = self.create_organization(name=f"Org {i+1}", slug=f"org-{i+1}")
            org_integration = self.create_organization_integration(
                integration=self.integration,
                organization_id=org.id,
            )
            with assume_test_silo_mode_of(Organization):
                org.flags.codecov_access = True
                org.save()
            org_mapping = OrganizationMapping.objects.get(organization_id=org.id)

            organizations.append(org)
            org_integrations.append(org_integration)
            org_mappings.append(org_mapping)

        event = {"action": "pull_request", "number": 123}

        with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(event)

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            # Verify all organizations are included
            assert isinstance(call_args, WebhookDetails)
            assert len(call_args.organizations) == 3
            org_names = {org.name for org in call_args.organizations}
            assert org_names == {"Org 1", "Org 2", "Org 3"}
            assert call_args.webhook_body == event

    @patch("sentry.overwatch_webhooks.consent_checks.OverwatchWebhookPublisher")
    def test_publisher_initialization_with_mocked_publisher(self, mock_publisher_class):
        """Test that publisher is initialized correctly with mocked publisher."""
        mock_publisher_instance = MagicMock()
        mock_publisher_class.return_value = mock_publisher_instance

        forwarder = OverwatchGithubWebhookForwarder(self.integration)

        mock_publisher_class.assert_called_once_with(integration_provider="github")
        assert forwarder.publisher == mock_publisher_instance

    def test_forward_if_applicable_all_valid_event_actions(self):
        """Test forward_if_applicable works for all valid event actions."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        with assume_test_silo_mode_of(Organization):
            organization.flags.codecov_access = True
            organization.save()

        # Test each valid event action
        for action in EVENTS_TO_FORWARD_OVERWATCH:
            event = {"action": action, "test_data": f"data_for_{action}"}

            with patch.object(self.forwarder.publisher, "enqueue_webhook") as mock_enqueue:
                self.forwarder.forward_if_applicable(event)
                mock_enqueue.assert_called_once()

                call_args = mock_enqueue.call_args[0][0]
                assert isinstance(call_args, WebhookDetails)
                assert call_args.webhook_body == event

    def test_forward_if_applicable_preserves_webhook_body_data(self):
        """Test that forward_if_applicable preserves all webhook body data."""
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        with assume_test_silo_mode_of(Organization):
            organization.flags.codecov_access = True
            organization.save()

        complex_event = {
            "action": "push",
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
