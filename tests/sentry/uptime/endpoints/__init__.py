from typing import int
from sentry.testutils.cases import APITestCase


class UptimeAlertBaseEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
