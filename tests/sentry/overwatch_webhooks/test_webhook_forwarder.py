from unittest.mock import patch

import orjson
import responses
from django.db import router, transaction
from django.test.utils import override_settings

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.integrations.github.webhook_types import (
    GITHUB_INSTALLATION_TARGET_ID_HEADER,
    GITHUB_WEBHOOK_TYPE_HEADER_KEY,
    GithubWebhookType,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.overwatch_webhooks.types import (
    DEFAULT_REQUEST_TYPE,
    OrganizationSummary,
    WebhookDetails,
)
from sentry.overwatch_webhooks.webhook_forwarder import OverwatchGithubWebhookForwarder
from sentry.overwatch_webhooks.webhook_publisher import OverwatchWebhookPublisher
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us", "de"))
class OverwatchGithubWebhookForwarderTest(TestCase):
    def setUp(self):
        self.integration = self.create_integration(
            provider="github",
            external_id="12345",
            name="Test Integration",
            organization=self.organization,
        )

        with assume_test_silo_mode_of(OrganizationIntegration):
            with outbox_context(
                transaction.atomic(using=router.db_for_write(OrganizationIntegration))
            ):
                # Delete the default org integration, it'll mess with our counts
                OrganizationIntegration.objects.filter(integration=self.integration).delete()

        self.forwarder = OverwatchGithubWebhookForwarder(self.integration)

    def test_init_creates_publisher_with_correct_provider(self):
        assert self.forwarder.integration == self.integration

    def test_should_forward_to_overwatch_with_valid_events(self):
        # Test installation events (always forwarded)
        for event_type in [
            GithubWebhookType.INSTALLATION,
            GithubWebhookType.INSTALLATION_REPOSITORIES,
        ]:
            headers = {GITHUB_WEBHOOK_TYPE_HEADER_KEY: event_type}
            is_forwardable, returned_event_type = self.forwarder.is_event_forwardable(headers)
            assert is_forwardable is True
            assert returned_event_type == event_type

        # Test events controlled by options
        for event_type in [GithubWebhookType.PULL_REQUEST, GithubWebhookType.ISSUE_COMMENT]:
            headers = {GITHUB_WEBHOOK_TYPE_HEADER_KEY: event_type}
            is_forwardable, returned_event_type = self.forwarder.is_event_forwardable(headers)
            assert is_forwardable is True
            assert returned_event_type == event_type

    def test_should_forward_to_overwatch_with_invalid_events(self):
        invalid_events = [
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: "invalid_action"},
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: "create"},
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: "delete"},
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: "some_other_action"},
            {},
        ]

        for event in invalid_events:
            is_forwardable, returned_event_type = self.forwarder.is_event_forwardable(event)
            assert is_forwardable is False
            assert returned_event_type is None

    def test_get_organizations_no_org_integrations(self):
        orgs = self.forwarder._get_org_summaries_by_region_for_integration(self.integration)
        assert orgs == {}

    def test_get_organizations_single_region(self):
        organization = self.create_organization(name="Test Org", slug="test-org")
        org_integration = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        orgs = self.forwarder._get_org_summaries_by_region_for_integration(self.integration)

        assert orgs == {
            "us": [
                OrganizationSummary(
                    name="Test Org",
                    slug="test-org",
                    id=organization.id,
                    region="us",
                    github_integration_id=self.integration.id,
                    organization_integration_id=org_integration.id,
                )
            ]
        }

    def test_get_organizations_multiple_orgs_mixed_regions(self):
        org1 = self.create_organization(name="Org 1", slug="org-1", region="us")
        org_integration1 = self.create_organization_integration(
            integration=self.integration,
            organization_id=org1.id,
        )

        org2 = self.create_organization(name="Org 2", slug="org-2", region="de")
        org_integration2 = self.create_organization_integration(
            integration=self.integration,
            organization_id=org2.id,
        )

        orgs = self.forwarder._get_org_summaries_by_region_for_integration(self.integration)
        assert orgs == {
            "us": [
                OrganizationSummary(
                    name="Org 1",
                    slug="org-1",
                    id=org1.id,
                    region="us",
                    github_integration_id=self.integration.id,
                    organization_integration_id=org_integration1.id,
                ),
            ],
            "de": [
                OrganizationSummary(
                    name="Org 2",
                    slug="org-2",
                    id=org2.id,
                    region="de",
                    github_integration_id=self.integration.id,
                    organization_integration_id=org_integration2.id,
                ),
            ],
        }

    def test_forward_if_applicable_no_organizations(self):
        event = {"action": "push", "data": "test"}

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                event, headers={GITHUB_WEBHOOK_TYPE_HEADER_KEY: "push"}
            )
            mock_enqueue.assert_not_called()

    @override_options({"overwatch.enabled-regions": ["us"]})
    def test_forward_if_applicable_event_not_eligible_for_forwarding(self):
        organization = self.create_organization(name="Test Org", slug="test-org")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        event = {"action": "create", "data": "test"}

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                event, headers={GITHUB_WEBHOOK_TYPE_HEADER_KEY: "invalid_action"}
            )
            mock_enqueue.assert_not_called()

    @override_options(
        {
            "overwatch.enabled-regions": ["us"],
            "seer.code-review.direct-to-seer-enabled-gh-orgs": ["sentry-ecosystem"],
        }
    )
    def test_forward_if_applicable_skips_seer_only_orgs(self):
        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        event = {
            "action": "pull_request",
            "repository": {"owner": {"login": "sentry-ecosystem"}},
            "commits": [],
        }

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                event,
                headers={
                    GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                    GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
                },
            )
            mock_enqueue.assert_not_called()

    @override_options({"overwatch.enabled-regions": ["us"]})
    def test_forward_if_applicable_successful_forwarding(self):
        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        event = {"action": "pull_request", "repository": "test-repo", "commits": []}

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                event,
                headers={
                    GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                    GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
                },
            )

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            assert isinstance(call_args, WebhookDetails)
            assert len(call_args.organizations) == 1
            assert call_args.organizations[0].name == "Test Org"
            assert call_args.webhook_body == event
            assert call_args.app_id == 987654

    @override_options({"overwatch.enabled-regions": ["us"]})
    def test_forward_if_applicable_multiple_organizations(self):
        for i in range(3):
            org = self.create_organization(name=f"Org {i+1}", slug=f"org-{i+1}", region="us")
            self.create_organization_integration(
                integration=self.integration,
                organization_id=org.id,
            )

        event = {"action": "pull_request", "number": 123}

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                event, headers={GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request"}
            )

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            assert isinstance(call_args, WebhookDetails)
            assert len(call_args.organizations) == 3
            org_names = {org.slug for org in call_args.organizations}
            assert org_names == {"org-1", "org-2", "org-3"}
            assert call_args.webhook_body == event

    @override_options({"overwatch.enabled-regions": ["us"]})
    def test_forward_if_applicable_all_valid_event_actions(self):
        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )

        # Test installation events (always forwarded) and events controlled by options
        event_types = [
            GithubWebhookType.INSTALLATION,
            GithubWebhookType.INSTALLATION_REPOSITORIES,
            GithubWebhookType.PULL_REQUEST,
        ]

        for event_type in event_types:
            event = {"action": "create", "test_data": f"data_for_{event_type}"}

            with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
                self.forwarder.forward_if_applicable(
                    event, headers={GITHUB_WEBHOOK_TYPE_HEADER_KEY: event_type}
                )
                mock_enqueue.assert_called_once()

                call_args = mock_enqueue.call_args[0][0]
                assert isinstance(call_args, WebhookDetails)
                assert call_args.webhook_body == event

    @override_options({"overwatch.enabled-regions": ["us"]})
    def test_forward_if_applicable_preserves_webhook_body_data(self):
        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
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

        with patch.object(OverwatchWebhookPublisher, "enqueue_webhook") as mock_enqueue:
            self.forwarder.forward_if_applicable(
                complex_event, headers={GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request"}
            )

            mock_enqueue.assert_called_once()
            call_args = mock_enqueue.call_args[0][0]

            assert isinstance(call_args, WebhookDetails)
            assert call_args.webhook_body == complex_event
            assert call_args.webhook_body["repository"]["name"] == "test-repo"
            assert len(call_args.webhook_body["commits"]) == 1
            assert call_args.webhook_body["commits"][0]["id"] == "abc123"

    @responses.activate
    @override_options({"overwatch.enabled-regions": ["us", "de"]})
    @override_settings(
        OVERWATCH_REGION_URLS={
            "us": "https://us.example.com/api",
            "de": "https://de.example.com/api",
        },
        OVERWATCH_WEBHOOK_SECRET="test-secret",
    )
    def test_forwards_to_correct_regions(self):
        responses.add(
            responses.POST,
            "https://us.example.com/api/webhooks/sentry",
            status=200,
        )
        responses.add(
            responses.POST,
            "https://de.example.com/api/webhooks/sentry",
            status=200,
        )

        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
        org_integration1 = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        organization2 = self.create_organization(name="Test Org 2", slug="test-org-2", region="de")
        org_integration2 = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization2.id,
        )
        event = {"action": "create", "repository": "test-repo", "commits": []}

        self.forwarder.forward_if_applicable(
            event,
            headers={
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
        )

        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == "https://us.example.com/api/webhooks/sentry"
        assert responses.calls[1].request.url == "https://de.example.com/api/webhooks/sentry"
        assert responses.calls[0].request.method == "POST"
        assert responses.calls[1].request.method == "POST"
        json_body = orjson.loads(responses.calls[0].request.body)

        assert json_body == {
            "organizations": [
                {
                    "name": "Test Org",
                    "slug": "test-org",
                    "id": organization.id,
                    "region": "us",
                    "github_integration_id": self.integration.id,
                    "organization_integration_id": org_integration1.id,
                }
            ],
            "webhook_body": event,
            "webhook_headers": {
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
            "integration_provider": "github",
            "region": "us",
            "event_type": "github",
            "app_id": 987654,
            "request_type": DEFAULT_REQUEST_TYPE,
        }
        json_body = orjson.loads(responses.calls[1].request.body)
        assert json_body == {
            "organizations": [
                {
                    "name": "Test Org 2",
                    "slug": "test-org-2",
                    "id": organization2.id,
                    "region": "de",
                    "github_integration_id": self.integration.id,
                    "organization_integration_id": org_integration2.id,
                }
            ],
            "webhook_body": event,
            "webhook_headers": {
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
            "integration_provider": "github",
            "region": "de",
            "event_type": "github",
            "app_id": 987654,
            "request_type": DEFAULT_REQUEST_TYPE,
        }

    @responses.activate
    @override_options({"overwatch.enabled-regions": ["us"]})
    @override_settings(
        OVERWATCH_REGION_URLS={"us": "https://us.example.com/api"},
        OVERWATCH_WEBHOOK_SECRET="test-secret",
    )
    def test_forwards_conditionally_to_some_regions(self):
        responses.add(
            responses.POST,
            "https://us.example.com/api/webhooks/sentry",
            status=200,
        )

        responses.add(
            responses.POST,
            "https://de.example.com/api/webhooks/sentry",
            status=200,
        )
        organization = self.create_organization(name="Test Org", slug="test-org", region="us")
        org_integration1 = self.create_organization_integration(
            integration=self.integration,
            organization_id=organization.id,
        )
        organization2 = self.create_organization(name="Test Org 2", slug="test-org-2", region="de")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization2.id,
        )
        event = {"action": "pull_request", "repository": "test-repo", "commits": []}

        self.forwarder.forward_if_applicable(
            event,
            headers={
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
        )

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://us.example.com/api/webhooks/sentry"
        assert responses.calls[0].request.method == "POST"
        json_body = orjson.loads(responses.calls[0].request.body)
        assert json_body == {
            "organizations": [
                {
                    "name": "Test Org",
                    "slug": "test-org",
                    "id": organization.id,
                    "region": "us",
                    "github_integration_id": self.integration.id,
                    "organization_integration_id": org_integration1.id,
                }
            ],
            "webhook_body": event,
            "webhook_headers": {
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
            "integration_provider": "github",
            "region": "us",
            "event_type": "github",
            "app_id": 987654,
            "request_type": DEFAULT_REQUEST_TYPE,
        }

    @responses.activate
    @override_options(
        {
            "overwatch.enabled-regions": ["us", "de"],
            "seer.code-review.direct-to-seer-regions.pull-request": ["de"],
        }
    )
    @override_settings(
        OVERWATCH_REGION_URLS={
            "us": "https://us.example.com/api",
            "de": "https://de.example.com/api",
        },
        OVERWATCH_WEBHOOK_SECRET="test-secret",
    )
    def test_skips_direct_to_seer_regions(self):
        """Test that regions in direct-to-seer list are skipped from Overwatch forwarding."""
        responses.add(
            responses.POST,
            "https://us.example.com/api/webhooks/sentry",
            status=200,
        )
        responses.add(
            responses.POST,
            "https://de.example.com/api/webhooks/sentry",
            status=200,
        )

        organization_us = self.create_organization(name="US Org", slug="us-org", region="us")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization_us.id,
        )
        organization_de = self.create_organization(name="DE Org", slug="de-org", region="de")
        self.create_organization_integration(
            integration=self.integration,
            organization_id=organization_de.id,
        )

        event = {"action": "opened", "repository": {"owner": {"login": "some-org"}}}

        self.forwarder.forward_if_applicable(
            event,
            headers={
                GITHUB_WEBHOOK_TYPE_HEADER_KEY: "pull_request",
                GITHUB_INSTALLATION_TARGET_ID_HEADER: "987654",
            },
        )

        # Only US should receive the webhook, DE is in the direct-to-seer list
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://us.example.com/api/webhooks/sentry"

    def test_default_events_included(self):
        """Test that default events should always be forwarded."""
        # Installation events are always forwarded
        is_forwardable, _ = self.forwarder.is_event_forwardable(
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: GithubWebhookType.INSTALLATION}
        )
        assert is_forwardable
        is_forwardable, _ = self.forwarder.is_event_forwardable(
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: GithubWebhookType.INSTALLATION_REPOSITORIES}
        )
        assert is_forwardable
        # PR and issue_comment events are forwardable to Overwatch
        is_forwardable, _ = self.forwarder.is_event_forwardable(
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: GithubWebhookType.PULL_REQUEST}
        )
        assert is_forwardable
        is_forwardable, _ = self.forwarder.is_event_forwardable(
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: GithubWebhookType.ISSUE_COMMENT}
        )
        assert is_forwardable

        is_forwardable, _ = self.forwarder.is_event_forwardable(
            {GITHUB_WEBHOOK_TYPE_HEADER_KEY: "some-unknown-event"}
        )
        assert not is_forwardable
