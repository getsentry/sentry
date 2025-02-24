from datetime import timedelta

from django.utils import timezone

from sentry.issues.grouptype import MetricIssuePOC, ProfileFileIOGroupType
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus, get_open_periods_for_group
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class GroupOpenPeriodsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.group = self.create_group()
        # test a new group has an open period
        self.group.type = MetricIssuePOC.type_id
        self.group.save()

        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="Test Alert Rule",
        )
        self.last_checked = timezone.now() - timedelta(
            seconds=self.alert_rule.snuba_query.time_window
        )

        self.url = f"/api/0/issues/{self.group.id}/open-periods/"

    def test_open_periods_flag_off(self) -> None:
        self.url = f"/api/0/issues/{self.group.id}/open-periods/"
        # open periods are not supported for non-metric issue groups
        self.group.type = ProfileFileIOGroupType.type_id
        self.group.save()

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []

    @with_feature("organizations:issue-open-periods")
    def test_open_periods_new_group(self) -> None:
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        open_period = response.data[0]
        assert open_period["start"] == self.group.first_seen
        assert open_period["end"] is None
        assert open_period["duration"] is None
        assert open_period["isOpen"] is True
        assert open_period["lastChecked"] >= self.last_checked

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

        response = self.client.get(self.url, format="json")
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

        # test that another open period is created
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
        response = self.client.get(self.url, format="json")
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

        # test that another open period is created
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
        open_periods = get_open_periods_for_group(self.group, limit=1)
        assert len(open_periods) == 1
        assert open_periods[0].to_dict() == {
            "start": unresolved_time,
            "end": second_resolved_time,
            "duration": second_resolved_time - unresolved_time,
            "isOpen": False,
            "lastChecked": second_resolved_time,
        }
