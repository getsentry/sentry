from __future__ import annotations

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class NotificationDefaultTest(APITestCase):
    endpoint = "sentry-api-0-notification-defaults"

    def test_basic(self):
        response = self.get_success_response()
        assert response.data == {
            "providerDefaults": ["email", "slack"],
            "typeDefaults": {
                "alerts": "always",
                "approval": "always",
                "deploy": "committed_only",
                "quota": "always",
                "quotaAttachments": "always",
                "quotaErrors": "always",
                "quotaReplays": "always",
                "quotaSpendAllocations": "always",
                "quotaTransactions": "always",
                "quotaWarnings": "always",
                "reports": "always",
                "spikeProtection": "always",
                "workflow": "subscribe_only",
            },
        }
