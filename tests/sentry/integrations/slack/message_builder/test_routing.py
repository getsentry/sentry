from sentry.integrations.slack.message_builder.routing import decode_action_id, encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.types import ExternalProviders
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class SlackRequestRoutingTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.integration = self.create_integration(
            organization=self.organization,
            provider=ExternalProviders.SLACK.value,
            external_id="slack:test",
        )
        self.encoded_action_id = (
            f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.slug}::{self.project.slug}"
        )

    @override_options({"hybrid_cloud.integration_region_targeting_rate": 0.0})
    def test_encode_action_id_non_targeted(self):
        action_id = encode_action_id(
            action=SlackAction.ARCHIVE_DIALOG,
            organization_slug=self.organization.slug,
            project_slug=self.project.slug,
            integration_id=self.integration.id,
        )
        assert action_id == SlackAction.ARCHIVE_DIALOG

    @override_options({"hybrid_cloud.integration_region_targeting_rate": 1.0})
    def test_encode_action_id_targeted(self):
        action_id = encode_action_id(
            action=SlackAction.ARCHIVE_DIALOG,
            organization_slug=self.organization.slug,
            project_slug=self.project.slug,
            integration_id=self.integration.id,
        )
        assert (
            action_id
            == f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.slug}::{self.project.slug}"
        )

    def test_decode_action_id_full(self):
        action_id = decode_action_id(
            f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.slug}::{self.project.slug}"
        )
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_slug == self.organization.slug
        assert action_id.project_slug == self.project.slug

    def test_decode_action_id_non_project(self):
        action_id = decode_action_id(f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.slug}")
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_slug == self.organization.slug
        assert action_id.project_slug is None

    def test_decode_action_id_non_encoded(self):
        action_id = decode_action_id(f"{SlackAction.ARCHIVE_DIALOG}")
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_slug is None
        assert action_id.project_slug is None
