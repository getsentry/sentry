from sentry.testutils.cases import APITestCase


class UptimeAlertBaseEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
