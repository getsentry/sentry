from typing import int
from sentry.integrations.slack.message_builder.routing import decode_action_id, encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.testutils.cases import TestCase


class SlackRequestRoutingTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    def test_encode_action_id(self) -> None:
        action_id = encode_action_id(
            action=SlackAction.ARCHIVE_DIALOG,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )
        assert (
            action_id == f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.id}::{self.project.id}"
        )

    def test_decode_action_id_full(self) -> None:
        action_id = decode_action_id(
            f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.id}::{self.project.id}"
        )
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_id == self.organization.id
        assert action_id.project_id == self.project.id

    def test_decode_action_id_non_project(self) -> None:
        action_id = decode_action_id(f"{SlackAction.ARCHIVE_DIALOG}::{self.organization.id}")
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_id == self.organization.id
        assert action_id.project_id is None

    def test_decode_action_id_non_encoded(self) -> None:
        action_id = decode_action_id(f"{SlackAction.ARCHIVE_DIALOG}")
        assert action_id.action == SlackAction.ARCHIVE_DIALOG
        assert action_id.organization_id is None
        assert action_id.project_id is None
