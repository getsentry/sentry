from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.detector_group import DetectorGroup


class OrganizationDetectorOpenPeriodsTest(APITestCase):
    @property
    def endpoint(self) -> str:
        return "sentry-api-0-organization-detector-open-periods"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.detector = self.create_detector()
        self.group = self.create_group()
        # Metric issue is the only type (currently) that has open periods
        self.group.type = MetricIssue.type_id
        self.group.save()

        # Link detector to group
        DetectorGroup.objects.create(detector=self.detector, group=self.group)

    def get_url_args(self):
        return [self.organization.slug, self.detector.id]

    @with_feature("organizations:issue-open-periods")
    def test_no_group_link(self) -> None:
        # Create a new detector with no linked group
        detector = self.create_detector()
        resp = self.get_success_response(self.organization.slug, detector.id)
        assert resp.data == []

    @with_feature("organizations:issue-open-periods")
    def test_open_period_linked_to_group(self) -> None:
        response = self.get_success_response(*self.get_url_args())
        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["duration"] is None
        assert open_period["isOpen"] is True
