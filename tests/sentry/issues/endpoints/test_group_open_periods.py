from django.utils import timezone

from sentry.issues.grouptype import MetricIssuePOC, ProfileFileIOGroupType
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class GroupOpenPeriodsTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.group = self.create_group()
        # test a new group has an open period
        self.group.type = MetricIssuePOC.type_id
        self.group.save()

        self.url = f"/api/0/issues/{self.group.id}/open-periods/"

    def test_open_periods_non_metric(self) -> None:
        self.url = f"/api/0/issues/{self.group.id}/open-periods/"
        # open periods are not supported for non-metric issue groups
        self.group.type = ProfileFileIOGroupType.type_id
        self.group.save()

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_open_periods_new_group(self) -> None:
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {"start": self.group.first_seen, "end": None, "duration": None, "isOpen": True}
        ]

    def test_open_periods_resolved_group(self) -> None:
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        resolved_time = timezone.now()
        Activity.objects.create(
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
            }
        ]

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
            type=ActivityType.SET_UNRESOLVED.value,
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
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "start": unresolved_time,
                "end": second_resolved_time,
                "duration": second_resolved_time - unresolved_time,
                "isOpen": False,
            },
            {
                "start": self.group.first_seen,
                "end": resolved_time,
                "duration": resolved_time - self.group.first_seen,
                "isOpen": False,
            },
        ]
