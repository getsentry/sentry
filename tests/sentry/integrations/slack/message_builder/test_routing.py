from sentry.integrations.slack.message_builder.routing import (
    SlackActionTracking,
    decode_action_id,
    encode_action_id,
)
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.testutils.cases import TestCase

TRACKING = SlackActionTracking(
    notification_uuid="6f3c9a52-1b9e-4b1f-9d8e-2a4c5e6f7a8b",
    source="seer-autofix-update",
)


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
        assert action_id.tracking is None

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

    def test_tracking_round_trip(self) -> None:
        for project_id in (self.project.id, None):
            encoded = encode_action_id(
                action=SlackAction.SEER_AUTOFIX_START,
                organization_id=self.organization.id,
                project_id=project_id,
                tracking=TRACKING,
            )
            decoded = decode_action_id(encoded)
            assert decoded.action == SlackAction.SEER_AUTOFIX_START
            assert decoded.organization_id == self.organization.id
            assert decoded.project_id == project_id
            assert decoded.tracking == TRACKING

    def test_suffix_round_trip(self) -> None:
        for project_id in (self.project.id, None):
            for tracking in (TRACKING, None):
                encoded = encode_action_id(
                    action=SlackAction.SEER_AUTOFIX_VIEW_PR,
                    organization_id=self.organization.id,
                    project_id=project_id,
                    suffix="123",
                    tracking=tracking,
                )
                decoded = decode_action_id(encoded)
                assert decoded.action == SlackAction.SEER_AUTOFIX_VIEW_PR
                assert decoded.organization_id == self.organization.id
                assert decoded.project_id == project_id
                assert decoded.tracking == tracking
                assert decoded.suffix == "123"

    def test_encode_action_id_drops_tracking_when_too_long(self) -> None:
        action = "a" * 250
        untracked = encode_action_id(action=action, organization_id=1, project_id=2)
        tracked = encode_action_id(
            action=action, organization_id=1, project_id=2, tracking=TRACKING
        )
        assert tracked == untracked

    def test_decode_action_id_incomplete_tracking(self) -> None:
        decoded = decode_action_id(f"{SlackAction.SEER_AUTOFIX_START}::1::2|n=abc")
        assert decoded.action == SlackAction.SEER_AUTOFIX_START
        assert decoded.organization_id == 1
        assert decoded.project_id == 2
        assert decoded.tracking is None
