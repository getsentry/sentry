from datetime import timedelta

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import (
    GroupOpenPeriod,
    create_open_period,
    get_open_periods_for_group,
    update_group_open_period,
)
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.detector_group import DetectorGroup


@freeze_time()
class OrganizationOpenPeriodsTest(APITestCase):
    @property
    def endpoint(self) -> str:
        return "sentry-api-0-organization-open-periods"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.detector = self.create_detector()
        self.group = self.create_group(type=MetricIssue.type_id, priority=PriorityLevel.LOW)

        # Link detector to group
        DetectorGroup.objects.create(detector=self.detector, group=self.group)

        self.group_open_period = GroupOpenPeriod.objects.get(group=self.group)

        self.opened_gopa = GroupOpenPeriodActivity.objects.create(
            date_added=self.group_open_period.date_added,
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.OPENED,
            value=self.group.priority,
        )

    def get_url_args(self) -> list[str]:
        return [self.organization.slug]

    def test_no_group_link(self) -> None:
        # Create a new detector with no linked group
        detector = self.create_detector()
        resp = self.get_success_response(
            self.organization.slug,
            qs_params={"detectorId": detector.id},
            status_code=200,
        )
        assert resp.data == []

    def test_open_period_linked_to_group(self) -> None:
        response = self.get_success_response(
            *self.get_url_args(), qs_params={"detectorId": self.detector.id}
        )
        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["isOpen"] is True
        assert len(open_period["activities"]) == 1
        assert open_period["activities"][0] == {
            "id": str(self.opened_gopa.id),
            "type": OpenPeriodActivityType.OPENED.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": self.opened_gopa.date_added,
        }

    def test_open_periods_group_id(self) -> None:
        response = self.get_success_response(
            *self.get_url_args(), qs_params={"groupId": self.group.id}
        )
        assert len(response.data) == 1

    def test_validation_error_when_missing_params(self) -> None:
        self.get_error_response(*self.get_url_args(), status_code=400)

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
        closed_gopa = GroupOpenPeriodActivity.objects.get(
            group_open_period=open_period, type=OpenPeriodActivityType.CLOSED
        )
        assert resp["id"] == str(open_period.id)
        assert resp["start"] == self.group.first_seen
        assert resp["end"] == resolved_time
        assert resp["isOpen"] is False
        assert len(resp["activities"]) == 2
        assert resp["activities"][0] == {
            "id": str(self.opened_gopa.id),
            "type": OpenPeriodActivityType.OPENED.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": self.opened_gopa.date_added,
        }
        assert resp["activities"][1] == {
            "id": str(closed_gopa.id),
            "type": OpenPeriodActivityType.CLOSED.to_str(),
            "value": None,
            "dateCreated": closed_gopa.date_added,
        }

    def test_open_periods_unresolved_group(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.first_seen = timezone.now() - timedelta(minutes=10)
        self.group.save()
        self.group_open_period.date_started = timezone.now() - timedelta(minutes=10)
        self.group_open_period.save()
        resolved_time = timezone.now() - timedelta(minutes=9)
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
        closed_gopa = GroupOpenPeriodActivity.objects.get(
            group_open_period=open_period, type=OpenPeriodActivityType.CLOSED
        )

        unresolved_time = timezone.now() - timedelta(minutes=8)
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
        second_resolved_time = timezone.now() - timedelta(minutes=7)
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
        opened_gopa2 = GroupOpenPeriodActivity.objects.get(
            group_open_period=open_period2, type=OpenPeriodActivityType.OPENED
        )
        closed_gopa2 = GroupOpenPeriodActivity.objects.get(
            group_open_period=open_period2, type=OpenPeriodActivityType.CLOSED
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
        assert resp["isOpen"] is False
        assert len(resp["activities"]) == 2
        assert resp["activities"][0] == {
            "id": str(opened_gopa2.id),
            "type": OpenPeriodActivityType.OPENED.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": opened_gopa2.date_added,
        }
        assert resp["activities"][1] == {
            "id": str(closed_gopa2.id),
            "type": OpenPeriodActivityType.CLOSED.to_str(),
            "value": None,
            "dateCreated": closed_gopa2.date_added,
        }

        assert resp2["id"] == str(open_period.id)
        assert resp2["start"] == self.group.first_seen
        assert resp2["end"] == resolved_time
        assert resp2["isOpen"] is False
        assert len(resp2["activities"]) == 2
        assert resp2["activities"][0] == {
            "id": str(self.opened_gopa.id),
            "type": OpenPeriodActivityType.OPENED.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": self.opened_gopa.date_added,
        }
        assert resp2["activities"][1] == {
            "id": str(closed_gopa.id),
            "type": OpenPeriodActivityType.CLOSED.to_str(),
            "value": None,
            "dateCreated": closed_gopa.date_added,
        }

    def test_open_periods_limit(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.first_seen = timezone.now() - timedelta(minutes=10)
        self.group.save()
        self.group_open_period.date_started = timezone.now() - timedelta(minutes=10)
        self.group_open_period.save()
        resolved_time = timezone.now() - timedelta(minutes=5)
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
        assert resp["isOpen"] is False

    def test_get_open_periods_time_range_starts_after_query_start(self) -> None:
        """Test that open periods starting after query_start and ending after query_end are included."""
        base_time = timezone.now() - timedelta(days=10)
        GroupOpenPeriod.objects.filter(group=self.group).delete()

        # Open period: Day 2 to Day 7
        open_period = GroupOpenPeriod.objects.create(
            group=self.group,
            project=self.group.project,
            date_started=base_time + timedelta(days=2),
            date_ended=base_time + timedelta(days=7),
        )

        # Query range: Day 0 to Day 5
        query_start = base_time.isoformat()
        query_end = (base_time + timedelta(days=5)).isoformat()

        response = self.get_success_response(
            *self.get_url_args(),
            qs_params={
                "groupId": self.group.id,
                "start": query_start,
                "end": query_end,
            },
        )

        assert len(response.data) == 1
        resp = response.data[0]
        assert resp["id"] == str(open_period.id)

    def test_get_open_periods_time_range_starts_before_ends_within(self) -> None:
        """Test that open periods starting before query_start and ending before query_end are included."""

        base_time = timezone.now() - timedelta(days=10)

        GroupOpenPeriod.objects.filter(group=self.group).delete()

        # Open period: Day 0 to Day 3 (ends within range)
        open_period = GroupOpenPeriod.objects.create(
            group=self.group,
            project=self.group.project,
            date_started=base_time,
            date_ended=base_time + timedelta(days=3),
        )

        # Query range: Day 2 to Day 7
        query_start = (base_time + timedelta(days=2)).isoformat()
        query_end = (base_time + timedelta(days=7)).isoformat()

        response = self.get_success_response(
            *self.get_url_args(),
            qs_params={
                "groupId": self.group.id,
                "start": query_start,
                "end": query_end,
            },
        )

        assert len(response.data) == 1
        resp = response.data[0]
        assert resp["id"] == str(open_period.id)

    def test_get_open_periods_time_range_starts_before_still_ongoing(self) -> None:
        """Test that open periods starting before query_start and still ongoing (date_ended=None) are included."""

        base_time = timezone.now() - timedelta(days=10)

        GroupOpenPeriod.objects.filter(group=self.group).delete()

        # Open period: Day 1 to ongoing
        open_period = GroupOpenPeriod.objects.create(
            group=self.group,
            project=self.group.project,
            date_started=base_time + timedelta(days=1),
            date_ended=None,
        )

        # Query range: Day 0 to Day 7
        query_start = base_time.isoformat()
        query_end = (base_time + timedelta(days=7)).isoformat()

        response = self.get_success_response(
            *self.get_url_args(),
            qs_params={
                "groupId": self.group.id,
                "start": query_start,
                "end": query_end,
            },
        )

        assert len(response.data) == 1
        resp = response.data[0]
        assert resp["id"] == str(open_period.id)

    def test_get_open_periods_none_in_range(self) -> None:
        """Test that open periods outside the query range are not included."""

        base_time = timezone.now() - timedelta(days=10)

        GroupOpenPeriod.objects.filter(group=self.group).delete()

        # Open period: Day 0 to Day 1 (starts + ends before query range)
        GroupOpenPeriod.objects.create(
            group=self.group,
            project=self.group.project,
            date_started=base_time,
            date_ended=base_time + timedelta(days=1),
        )

        # Query range: Day 2 to Day 7
        query_start = (base_time + timedelta(days=2)).isoformat()
        query_end = (base_time + timedelta(days=7)).isoformat()

        response = self.get_success_response(
            *self.get_url_args(),
            qs_params={
                "groupId": self.group.id,
                "start": query_start,
                "end": query_end,
            },
        )

        assert len(response.data) == 0

    def test_open_period_activities_time_period(self) -> None:
        curr_time = self.group_open_period.date_added

        self.group_open_period.date_added = curr_time - timedelta(minutes=10)
        self.group_open_period.date_started = curr_time - timedelta(minutes=10)
        self.group_open_period.save()

        self.opened_gopa.date_added = self.group_open_period.date_added
        self.opened_gopa.value = PriorityLevel.MEDIUM
        self.opened_gopa.save()

        update_gopa = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.group_open_period,
            type=OpenPeriodActivityType.STATUS_CHANGE,
            value=self.group.priority,
        )
        update_gopa.date_added = curr_time - timedelta(minutes=6)
        update_gopa.save()

        response = self.get_success_response(
            *self.get_url_args(),
            qs_params={
                "detectorId": self.detector.id,
                "start": curr_time - timedelta(minutes=5),
                "end": timezone.now(),
            },
        )

        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group_open_period.date_started
        assert open_period["end"] is None
        assert open_period["isOpen"] is True
        assert (
            len(open_period["activities"]) == 1
        )  # don't include the opened GOPA, whose date_added doesn't overlap
        assert open_period["activities"][0] == {
            "id": str(update_gopa.id),
            "type": OpenPeriodActivityType.STATUS_CHANGE.to_str(),
            "value": PriorityLevel(self.group.priority).to_str(),
            "dateCreated": update_gopa.date_added,
        }
