from collections.abc import Callable

from sentry.models.groupshare import GroupShare
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class SharedGroupDetailsTest(APITestCase):
    def _get_path_functions(
        self,
    ) -> tuple[Callable[[str], str], Callable[[str], str], Callable[[str], str]]:
        # The urls for shared group details are supported both with an org slug and without.
        # We test both as long as we support both.
        # Because removing old urls takes time and consideration of the cost of breaking lingering references, a
        # decision to permanently remove either path schema is a TODO.
        return (
            lambda share_id: f"/api/0/shared/issues/{share_id}/",
            lambda share_id: f"/api/0/organizations/{self.organization.slug}/shared/issues/{share_id}/",
            lambda share_id: f"/api/0/organizations/{self.organization.id}/shared/issues/{share_id}/",
        )

    def test_simple(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["latestEvent"]["id"] == str(event.event_id)
            assert response.data["project"]["slug"] == group.project.slug
            assert response.data["project"]["organization"]["slug"] == group.organization.slug

    def test_does_not_leak_assigned_to(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["latestEvent"]["id"] == str(event.event_id)
            assert response.data["project"]["slug"] == group.project.slug
            assert response.data["project"]["organization"]["slug"] == group.organization.slug
            assert "assignedTo" not in response.data

    def test_feature_disabled(self) -> None:
        self.login_as(user=self.user)

        group = self.create_group()
        org = group.organization
        org.flags.disable_shared_issues = True
        org.save()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 404

    def test_permalink(self) -> None:
        group = self.create_group()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert not response.data["permalink"]  # not show permalink when not logged in

        self.login_as(user=self.user)
        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["permalink"]  # show permalink when logged in
