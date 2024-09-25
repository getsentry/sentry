from sentry.testutils.cases import APITestCase, UptimeTestCaseMixin


class UptimeAlertBaseEndpointTest(UptimeTestCaseMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
