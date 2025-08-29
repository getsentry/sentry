from datetime import timedelta

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models.detector_group import DetectorGroup


class OrganizationOpenPeriodsTest(APITestCase):
    @property
    def endpoint(self) -> str:
        return "sentry-api-0-organization-open-periods"

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
        return [self.organization.slug]

    @with_feature("organizations:issue-open-periods")
    def test_no_group_link(self) -> None:
        # Create a new detector with no linked group
        detector = self.create_detector()
        resp = self.get_success_response(
            self.organization.slug, qs_params={"detectorId": detector.id}
        )
        assert resp.data == []

    @with_feature("organizations:issue-open-periods")
    def test_open_period_linked_to_group(self) -> None:
        response = self.get_success_response(
            *self.get_url_args(), qs_params={"detectorId": self.detector.id}
        )
        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["duration"] is None
        assert open_period["isOpen"] is True

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_group_id(self) -> None:
        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert len(response.data) == 1

    def test_validation_error_when_missing_params(self) -> None:
        self.get_error_response(*self.get_url_args(), status_code=400)

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_new_group_with_last_checked(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="Test Alert Rule",
        )
        last_checked = timezone.now() - timedelta(seconds=alert_rule.snuba_query.time_window)

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["duration"] is None
        assert open_period["isOpen"] is True
        assert open_period["lastChecked"] >= last_checked

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_resolved_group(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "start": self.group.first_seen,
                "end": resolved_time,
                "duration": resolved_time - self.group.first_seen,
                "isOpen": False,
                "lastChecked": activity.datetime,
            }
        ]

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_unresolved_group(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )

        unresolved_time = timezone.now()
        self.group.status = GroupStatus.UNRESOLVED
        self.group.save()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=unresolved_time,
        )

        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        second_resolved_time = timezone.now()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=second_resolved_time,
        )

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "start": unresolved_time,
                "end": second_resolved_time,
                "duration": second_resolved_time - unresolved_time,
                "isOpen": False,
                "lastChecked": second_resolved_time,
            },
            {
                "start": self.group.first_seen,
                "end": resolved_time,
                "duration": resolved_time - self.group.first_seen,
                "isOpen": False,
                "lastChecked": resolved_time,
            },
        ]

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_limit(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )

        unresolved_time = timezone.now()
        self.group.status = GroupStatus.UNRESOLVED
        self.group.save()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=unresolved_time,
        )

        second_resolved_time = timezone.now()
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=second_resolved_time,
        )

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id, "per_page": 1}
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            "start": unresolved_time,
            "end": second_resolved_time,
            "duration": second_resolved_time - unresolved_time,
            "isOpen": False,
            "lastChecked": second_resolved_time,
        }
