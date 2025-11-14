from typing import int
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.testutils.cases import TestCase


class TestRpcIntegration(TestCase):
    def test_repr(self) -> None:
        integration = RpcIntegration(
            id=1,
            name="Test Integration",
            metadata={"secret": "shhhh"},
            status=ObjectStatus.ACTIVE,
            provider="test",
            external_id="test-external-id",
        )
        assert (
            repr(integration)
            == "RpcIntegration(id=1, provider='test', external_id='test-external-id', name='Test Integration', status=0)"
        )

        assert "shhhh" not in str(integration)
