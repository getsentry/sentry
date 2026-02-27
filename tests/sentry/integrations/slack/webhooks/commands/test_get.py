from rest_framework import status

from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


class SlackCommandsGetTest(SlackCommandsTest):
    method = "get"

    def test_method_get_not_allowed(self) -> None:
        self.get_error_response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)


# TEMPORARY: intentional failure to test CI reporting (remove after verifying)
def test_intentional_failure_for_ci_reporting():
    assert False, "Intentional failure to test backend CI failure reporting"
