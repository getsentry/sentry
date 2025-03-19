from sentry.incidents.grouptype import MetricAlertFire
from sentry.issues.grouptype import MonitorIncidentType, UptimeDomainCheckFailure
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationDataConditionAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-type-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.create_detector(name="metric detector", type=MetricAlertFire.slug)
        self.create_detector(name="crons detector", type=MonitorIncidentType.slug)
        self.create_detector(name="uptime detector", type=UptimeDomainCheckFailure.slug)


@region_silo_test
class OrganizationDataConditionIndexBaseTest(OrganizationDataConditionAPITestCase):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert len(response.data) == 3
        assert set(response.data) == {
            MetricAlertFire.slug,
            MonitorIncidentType.slug,
            UptimeDomainCheckFailure.slug,
        }
