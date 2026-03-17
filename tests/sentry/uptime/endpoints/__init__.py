from unittest import mock

from sentry.testutils.cases import APITestCase


class UptimeAlertBaseEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.mock_invoke_checker_validator_ctx = mock.patch(
            "sentry.uptime.checker_api.invoke_checker_validator", return_value=None
        )
        self.mock_invoke_checker_validator = self.mock_invoke_checker_validator_ctx.__enter__()

    def tearDown(self) -> None:
        super().tearDown()
        self.mock_invoke_checker_validator_ctx.__exit__(None, None, None)
