from unittest.mock import patch

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.testutils.cases import APITestCase
from sentry.types.activity import ActivityType


class GroupReprocessingEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.user = self.create_user()
        self.create_member(user=self.user, organization=self.org, role="owner")
        self.login_as(self.user)

    def _url(self, group_id: int) -> str:
        return f"/api/0/issues/{group_id}/reprocessing/"

    def _create_reprocess_activity(
        self, old_group: Group, new_group: Group, event_count: int = 10
    ) -> Activity:
        return Activity.objects.create(
            project=self.project,
            group_id=old_group.id,
            type=ActivityType.REPROCESS.value,
            data={
                "oldGroupId": old_group.id,
                "newGroupId": new_group.id,
                "eventCount": event_count,
            },
        )

    def test_allows_when_no_parent(self) -> None:
        lone_group = self.create_group(project=self.project)

        resp = self.client.post(self._url(lone_group.id), data={"remainingEvents": "keep"})

        assert resp.status_code == 200

    def test_allows_when_parent_finished(self) -> None:
        old_group = self.create_group(project=self.project)
        new_group = self.create_group(project=self.project)

        self._create_reprocess_activity(old_group, new_group)

        with patch(
            "sentry.issues.endpoints.group_reprocessing.is_group_finished", return_value=True
        ):
            resp = self.client.post(self._url(new_group.id), data={"remainingEvents": "keep"})

        assert resp.status_code == 200

    def test_blocks_when_parent_in_progress(self) -> None:
        old_group = self.create_group(project=self.project)
        new_group = self.create_group(project=self.project)

        self._create_reprocess_activity(old_group, new_group)

        with patch(
            "sentry.issues.endpoints.group_reprocessing.is_group_finished", return_value=False
        ):
            resp = self.client.post(self._url(new_group.id), data={"remainingEvents": "keep"})

        assert resp.status_code == 409
