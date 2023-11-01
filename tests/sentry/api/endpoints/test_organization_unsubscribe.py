from django.urls import reverse

from sentry.models.groupsubscription import GroupSubscription
from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils.linksign import generate_signed_link


@region_silo_test(stable=True)
class OrganizationUnsubscribeProjectTest(APITestCase):
    endpoint = "sentry-api-0-organization-unsubscribe-project"

    def test_get_renders(self):
        project = self.create_project(organization=self.organization)
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, project.id]
        )

        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data["viewUrl"] == project.get_absolute_url()
        assert resp.data["type"] == "project"
        assert resp.data["displayName"] == self.user.get_display_name()
        assert resp.data["slug"] == project.slug

    def test_get_non_member(self):
        # Users cannot unsubscribe once they are not a member anymore.
        non_member = self.create_user(email="other@example.com")
        project = self.create_project(organization=self.organization)
        path = generate_signed_link(
            user=non_member, viewname=self.endpoint, args=[self.organization.slug, project.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_get_missing_record(self):
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, 987654321]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_get_no_signature(self):
        project = self.create_project(organization=self.organization)
        path = reverse(self.endpoint, args=[self.organization.slug, project.id])

        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_post_non_member(self):
        # Users cannot unsubscribe once they are not a member anymore.
        non_member = self.create_user(email="other@example.com")
        project = self.create_project(organization=self.organization)
        path = generate_signed_link(
            user=non_member, viewname=self.endpoint, args=[self.organization.slug, project.id]
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

    def test_post_missing_record(self):
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, 987654321]
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

    def test_post_no_signature(self):
        project = self.create_project(organization=self.organization)
        path = reverse(self.endpoint, args=[self.organization.slug, project.id])

        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_post_success(self):
        project = self.create_project(organization=self.organization)
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, project.id]
        )
        resp = self.client.post(path, data={"cancel": "1"})
        assert resp.status_code == 201
        with assume_test_silo_mode(SiloMode.CONTROL):
            setting = NotificationSetting.objects.find_settings(
                provider=ExternalProviders.EMAIL,
                type=NotificationSettingTypes.ISSUE_ALERTS,
                user_id=self.user.id,
                project=project.id,
            ).get()
            assert setting.value == NotificationSettingOptionValues.NEVER


@region_silo_test(stable=True)
class OrganizationUnsubscribeIssueTest(APITestCase):
    endpoint = "sentry-api-0-organization-unsubscribe-issue"

    def test_get_renders(self):
        group = self.create_group(self.project)
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, group.id]
        )

        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data["viewUrl"] == group.get_absolute_url()
        assert resp.data["type"] == "issue"
        assert resp.data["displayName"] == self.user.get_display_name()
        assert "slug" not in resp.data

    def test_get_non_member(self):
        # Users cannot unsubscribe once they are not a member anymore.
        non_member = self.create_user(email="other@example.com")
        group = self.create_group(project=self.project)
        path = generate_signed_link(
            user=non_member, viewname=self.endpoint, args=[self.organization.slug, group.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_get_missing_record(self):
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, 987654321]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_post_non_member(self):
        # Users cannot unsubscribe once they are not a member anymore.
        non_member = self.create_user(email="other@example.com")
        group = self.create_group(project=self.project)
        path = generate_signed_link(
            user=non_member, viewname=self.endpoint, args=[self.organization.slug, group.id]
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

    def test_post_missing_record(self):
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, 987654321]
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

    def test_post_success(self):
        group = self.create_group(project=self.project)
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, group.id]
        )
        resp = self.client.post(path, data={"cancel": "1"})
        assert resp.status_code == 201

        sub = GroupSubscription.objects.get(group=group, user_id=self.user.id)
        assert sub.is_active is False
