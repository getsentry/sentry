from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:timeseries-annotations")
class TimeseriesAnnotationEndpointTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-timeseries-annotations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
