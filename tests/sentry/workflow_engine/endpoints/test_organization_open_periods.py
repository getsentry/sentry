from datetime import timedelta

from django.utils import timezone
from rest_framework import status

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import (
    GroupOpenPeriod,
    create_open_period,
    get_open_periods_for_group,
    update_group_open_period,
)
from sentry.testutils.cases import APITestCase
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

    def test_no_group_link(self) -> None:
        # Create a new detector with no linked group
        detector = self.create_detector()
        resp = self.get_error_response(
            self.organization.slug,
            qs_params={"detectorId": detector.id},
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Group not found. Could not query open periods."

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

    def test_open_periods_group_id(self) -> None:
        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert len(response.data) == 1

    def test_validation_error_when_missing_params(self) -> None:
        self.get_error_response(*self.get_url_args(), status_code=400)

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
        resp = response.data[0]
        open_period = GroupOpenPeriod.objects.get(group=self.group)
        assert resp["id"] == str(open_period.id)
        assert resp["start"] == self.group.first_seen
        assert resp["end"] is None
        assert resp["duration"] is None
        assert resp["isOpen"] is True
        assert resp["lastChecked"] >= last_checked

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
        update_group_open_period(
            group=self.group,
            new_status=GroupStatus.RESOLVED,
            resolution_time=resolved_time,
            resolution_activity=activity,
        )

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )

        assert response.status_code == 200, response.content
        resp = response.data[0]
        open_period = GroupOpenPeriod.objects.get(group=self.group, date_ended=resolved_time)
        assert resp["id"] == str(open_period.id)
        assert resp["start"] == self.group.first_seen
        assert resp["end"] == resolved_time
        assert resp["duration"] == resolved_time - self.group.first_seen
        assert resp["isOpen"] is False
        assert resp["lastChecked"].replace(second=0, microsecond=0) == activity.datetime.replace(
            second=0, microsecond=0
        )

    def test_open_periods_unresolved_group(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        resolve_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )
        update_group_open_period(
            group=self.group,
            new_status=GroupStatus.RESOLVED,
            resolution_time=resolved_time,
            resolution_activity=resolve_activity,
        )
        open_period = GroupOpenPeriod.objects.get(group=self.group, date_ended=resolved_time)

        unresolved_time = timezone.now()
        self.group.status = GroupStatus.UNRESOLVED
        self.group.save()
        regression_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=unresolved_time,
        )
        create_open_period(self.group, regression_activity.datetime)

        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        second_resolved_time = timezone.now()
        second_resolve_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=second_resolved_time,
        )
        update_group_open_period(
            group=self.group,
            new_status=GroupStatus.RESOLVED,
            resolution_time=second_resolved_time,
            resolution_activity=second_resolve_activity,
        )
        open_period2 = GroupOpenPeriod.objects.get(
            group=self.group, date_ended=second_resolved_time
        )

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert response.status_code == 200, response.content
        resp = response.data[0]
        resp2 = response.data[1]

        assert resp["id"] == str(open_period2.id)
        assert resp["start"] == unresolved_time
        assert resp["end"] == second_resolved_time
        assert resp["duration"] == second_resolved_time - unresolved_time
        assert resp["isOpen"] is False
        assert resp["lastChecked"].replace(second=0, microsecond=0) == second_resolved_time.replace(
            second=0, microsecond=0
        )

        assert resp2["id"] == str(open_period.id)
        assert resp2["start"] == self.group.first_seen
        assert resp2["end"] == resolved_time
        assert resp2["duration"] == resolved_time - self.group.first_seen
        assert resp2["isOpen"] is False
        assert resp2["lastChecked"].replace(second=0, microsecond=0) == resolved_time.replace(
            second=0, microsecond=0
        )

    def test_open_periods_limit(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        resolve_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=resolved_time,
        )
        update_group_open_period(
            group=self.group,
            new_status=GroupStatus.RESOLVED,
            resolution_time=resolved_time,
            resolution_activity=resolve_activity,
        )
        get_open_periods_for_group(self.group)

        unresolved_time = timezone.now()
        self.group.status = GroupStatus.UNRESOLVED
        self.group.save()
        regression_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_REGRESSION.value,
            datetime=unresolved_time,
        )
        create_open_period(self.group, regression_activity.datetime)

        second_resolved_time = timezone.now()
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        second_resolve_activity = Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=second_resolved_time,
        )
        update_group_open_period(
            group=self.group,
            new_status=GroupStatus.RESOLVED,
            resolution_time=second_resolved_time,
            resolution_activity=second_resolve_activity,
        )
        open_period = GroupOpenPeriod.objects.get(group=self.group, date_ended=second_resolved_time)

        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id, "per_page": 1}
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        resp = response.data[0]
        assert resp["id"] == str(open_period.id)
        assert resp["start"] == unresolved_time
        assert resp["end"] == second_resolved_time
        assert resp["duration"] == second_resolved_time - unresolved_time
        assert resp["isOpen"] is False
        assert resp["lastChecked"].replace(second=0, microsecond=0) == second_resolved_time.replace(
            second=0, microsecond=0
        )
