from sentry.models.apiapplication import ApiApplication
from sentry.models.apigrant import ApiGrant
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiGrantTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com"
        )
        self.grant = ApiGrant.objects.create(
            user=self.user, application=self.application, redirect_uri="https://example.com"
        )

    def test_default_string_serialization(self):
        default_msg = f"api_grant_id={self.grant.id}, user_id={self.user.id}, application_id={self.application.id} is cool"
        assert f"{self.grant} is cool" == default_msg
