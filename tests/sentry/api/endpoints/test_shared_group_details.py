from django.db.models import F

from sentry.models import GroupShare, Organization
from sentry.services.hybrid_cloud.organization_actions.impl import (
    update_organization_with_outbox_message,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


def set_disable_shared_issues_for_org(*, org: Organization, enabled=True):
    flags = F("flags").bitor(Organization.flags.disable_shared_issues)

    if not enabled:
        flags = F("flags").bitand(~Organization.flags.disable_shared_issues)

    update_organization_with_outbox_message(
        org_id=org.id,
        update_data={"flags": flags},
    )


@region_silo_test(stable=True)
class SharedGroupDetailsTest(APITestCase):
    def _get_path_functions(self):
        # The urls for shared group details are supported both with an org slug and without.
        # We test both as long as we support both.
        # Because removing old urls takes time and consideration of the cost of breaking lingering references, a
        # decision to permanently remove either path schema is a TODO.
        return (
            lambda share_id: f"/api/0/shared/issues/{share_id}/",
            lambda share_id: f"/api/0/organizations/{self.organization.slug}/shared/issues/{share_id}/",
        )

    def test_simple(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
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

    def test_feature_disabled(self):
        self.login_as(user=self.user)

        group = self.create_group()
        org = group.organization
        set_disable_shared_issues_for_org(org=org)
        org.refresh_from_db()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 404

    def test_permalink(self):
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
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["permalink"]  # show permalink when logged in
