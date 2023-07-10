from rest_framework import status

from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


@control_silo_test
class SlackCommandsGetTest(SlackCommandsTest):
    method = "get"

    def test_method_get_not_allowed(self):
        self.get_error_response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
