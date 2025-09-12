from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class GroupOpenPeriodsEndpointEndpointTest(APITestCase):
    def setUp(self):
        self.url = f"/api/0/issues/{self.group.id}/open-periods/"
        self.group = self.create_group()
        self.login_as(user=self.user)

    @with_feature("organizations:issue-open-periods")
    def test_endpoint_with_no_open_periods(self) -> None:
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        open_periods = response.data["openPeriods"]
        assert len(open_periods) == 0

    @with_feature("organizations:issue-open-periods")
    def test_endpoint_with_open_periods(self) -> None:
        self.group.type = MetricIssue.type_id
        self.group.save()

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        open_periods = response.data["openPeriods"]
        assert len(open_periods) == 1
        open_period = open_periods[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["duration"] is None
        assert open_period["isOpen"] is True
        # TODO: assert open_period["lastChecked"] > time
