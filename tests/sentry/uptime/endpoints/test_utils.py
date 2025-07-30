import uuid

from pytest import raises

from sentry.testutils.cases import TestCase
from sentry.uptime.endpoints.utils import authorize_and_map_project_uptime_subscription_ids


class AuthorizeAndMapProjectUptimeSubscriptionIdsTest(TestCase):
    def test_successful_authorization_and_mapping(self):
        """Test successful authorization and mapping of subscription IDs."""
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id
        )
        project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=subscription, project=self.project
        )

        # Test with hex formatter (EAP style)
        hex_formatter = lambda sub_id: uuid.UUID(sub_id).hex

        mapping, subscription_ids = authorize_and_map_project_uptime_subscription_ids(
            project_uptime_subscription_ids=[str(project_uptime_subscription.id)],
            projects=[self.project],
            sub_id_formatter=hex_formatter,
        )

        # Verify mapping
        expected_hex_id = uuid.UUID(subscription_id).hex
        assert expected_hex_id in mapping
        assert mapping[expected_hex_id] == project_uptime_subscription.id

        # Verify subscription IDs list
        assert subscription_ids == [expected_hex_id]

    def test_invalid_subscription_id_raises_error(self):
        """Test that invalid subscription IDs raise ValueError."""
        invalid_id = "999999"

        with raises(ValueError):
            authorize_and_map_project_uptime_subscription_ids(
                project_uptime_subscription_ids=[invalid_id],
                projects=[self.project],
                sub_id_formatter=str,
            )

    def test_cross_project_access_denied(self):
        """Test that cross-project subscription access is denied."""
        other_project = self.create_project(organization=self.organization)
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://example.com", subscription_id=subscription_id
        )
        other_project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=subscription, project=other_project
        )

        # Try to authorize with original project, should fail
        with raises(ValueError):
            authorize_and_map_project_uptime_subscription_ids(
                project_uptime_subscription_ids=[str(other_project_uptime_subscription.id)],
                projects=[self.project],  # Wrong project
                sub_id_formatter=str,
            )

    def test_multiple_subscriptions(self):
        """Test authorization with multiple subscription IDs."""
        subscription_id1 = uuid.uuid4().hex
        subscription_id2 = uuid.uuid4().hex

        subscription1 = self.create_uptime_subscription(
            url="https://example1.com", subscription_id=subscription_id1
        )
        subscription2 = self.create_uptime_subscription(
            url="https://example2.com", subscription_id=subscription_id2
        )

        project_uptime_subscription1 = self.create_project_uptime_subscription(
            uptime_subscription=subscription1, project=self.project
        )
        project_uptime_subscription2 = self.create_project_uptime_subscription(
            uptime_subscription=subscription2, project=self.project
        )

        string_formatter = lambda sub_id: str(uuid.UUID(sub_id))

        mapping, subscription_ids = authorize_and_map_project_uptime_subscription_ids(
            project_uptime_subscription_ids=[
                str(project_uptime_subscription1.id),
                str(project_uptime_subscription2.id),
            ],
            projects=[self.project],
            sub_id_formatter=string_formatter,
        )

        # Verify both subscriptions are mapped
        assert len(mapping) == 2
        assert len(subscription_ids) == 2

        expected_str_id1 = str(uuid.UUID(subscription_id1))
        expected_str_id2 = str(uuid.UUID(subscription_id2))

        assert expected_str_id1 in mapping
        assert expected_str_id2 in mapping
        assert mapping[expected_str_id1] == project_uptime_subscription1.id
        assert mapping[expected_str_id2] == project_uptime_subscription2.id
