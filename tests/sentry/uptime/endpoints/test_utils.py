from typing import int
import uuid

from pytest import raises

from sentry.testutils.cases import TestCase
from sentry.uptime.endpoints.utils import authorize_and_map_uptime_detector_subscription_ids


class AuthorizeAndMapUptimeDetectorSubscriptionIdsTest(TestCase):
    def test_successful_authorization_and_mapping(self) -> None:
        """Test successful authorization and mapping of detector subscription IDs."""
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id
        )
        detector = self.create_uptime_detector(
            uptime_subscription=subscription, project=self.project
        )
        mapping, subscription_ids = authorize_and_map_uptime_detector_subscription_ids(
            detector_ids=[str(detector.id)],
            projects=[self.project],
        )
        expected_hex_id = uuid.UUID(subscription_id).hex
        assert expected_hex_id in mapping
        assert mapping[expected_hex_id] == detector.id

        assert subscription_ids == [expected_hex_id]

    def test_invalid_detector_id_raises_error(self) -> None:
        """Test that invalid detector IDs raise ValueError."""
        invalid_id = "999999"

        with raises(ValueError):
            authorize_and_map_uptime_detector_subscription_ids(
                detector_ids=[invalid_id],
                projects=[self.project],
            )

    def test_cross_project_access_denied(self) -> None:
        """Test that cross-project detector access is denied."""
        other_project = self.create_project(organization=self.organization)
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id
        )
        other_detector = self.create_uptime_detector(
            uptime_subscription=subscription, project=other_project
        )

        # Try to authorize with original project, should fail
        with raises(ValueError):
            authorize_and_map_uptime_detector_subscription_ids(
                detector_ids=[str(other_detector.id)],
                projects=[self.project],
            )

    def test_multiple_detectors(self) -> None:
        """Test authorization with multiple detector IDs."""
        subscription_id1 = uuid.uuid4().hex
        subscription_id2 = uuid.uuid4().hex

        subscription1 = self.create_uptime_subscription(
            url="https://example1.com", subscription_id=subscription_id1
        )
        subscription2 = self.create_uptime_subscription(
            url="https://example2.com", subscription_id=subscription_id2
        )
        detector1 = self.create_uptime_detector(
            uptime_subscription=subscription1, project=self.project
        )
        detector2 = self.create_uptime_detector(
            uptime_subscription=subscription2, project=self.project
        )
        mapping, subscription_ids = authorize_and_map_uptime_detector_subscription_ids(
            detector_ids=[str(detector1.id), str(detector2.id)],
            projects=[self.project],
        )

        assert len(mapping) == 2
        assert len(subscription_ids) == 2

        expected_str_id1 = uuid.UUID(subscription_id1).hex
        expected_str_id2 = uuid.UUID(subscription_id2).hex

        assert expected_str_id1 in mapping
        assert expected_str_id2 in mapping
        assert mapping[expected_str_id1] == detector1.id
        assert mapping[expected_str_id2] == detector2.id
