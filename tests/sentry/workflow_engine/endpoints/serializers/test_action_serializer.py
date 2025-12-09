from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action

pytestmark = [requires_snuba]


class TestActionSerializer(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            provider="slack",
            name="example-integration",
            external_id="123-id",
            metadata={},
            organization=self.organization,
        )

    def test_serialize_simple(self) -> None:
        action = self.create_action(
            type=Action.Type.PLUGIN,
            data={},
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "plugin",
            "data": {},
            "integrationId": None,
            "config": {},
            "status": "active",
        }

    def test_serialize_disabled(self) -> None:
        action = self.create_action(
            type=Action.Type.PLUGIN,
            data={},
            status=ObjectStatus.DISABLED,
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "plugin",
            "data": {},
            "integrationId": None,
            "config": {},
            "status": "disabled",
        }

    def test_serialize_with_integration(self) -> None:

        action = self.create_action(
            type=Action.Type.OPSGENIE,
            data={"priority": "P1"},
            integration_id=self.integration.id,
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "opsgenie",
            "data": {"priority": "P1"},
            "integrationId": str(self.integration.id),
            "config": {"targetType": "specific", "targetIdentifier": "123"},
            "status": "active",
        }

    def test_serialize_with_integration_and_config(self) -> None:
        action2 = self.create_action(
            type=Action.Type.SLACK,
            data={"tags": "bar"},
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_display": "freddy frog",
                "target_identifier": "123-id",
            },
        )

        result2 = serialize(action2)

        assert result2 == {
            "id": str(action2.id),
            "type": "slack",
            "data": {"tags": "bar"},
            "integrationId": str(self.integration.id),
            "config": {
                "targetType": "specific",
                "targetDisplay": "freddy frog",
                "targetIdentifier": "123-id",
            },
            "status": "active",
        }

    def test_serialize_with_data(self) -> None:
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={"fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS},
            config={
                "target_type": ActionTarget.ISSUE_OWNERS,
            },
        )

        result = serialize(action)

        assert result == {
            "id": str(action.id),
            "type": "email",
            "data": {"fallthroughType": "ActiveMembers"},
            "integrationId": None,
            "config": {
                "targetType": "issue_owners",
            },
            "status": "active",
        }
