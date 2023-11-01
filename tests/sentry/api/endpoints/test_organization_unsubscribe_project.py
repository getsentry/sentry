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

    def test_post_success(self):
        project = self.create_project(organization=self.organization)
        path = generate_signed_link(
            user=self.user, viewname=self.endpoint, args=[self.organization.slug, project.id]
        )
        resp = self.client.post(path, data={"cancel": "1"})
        assert resp.status_code == 204
        with assume_test_silo_mode(SiloMode.CONTROL):
            setting = NotificationSetting.objects.find_settings(
                provider=ExternalProviders.EMAIL,
                type=NotificationSettingTypes.ISSUE_ALERTS,
                user_id=self.user.id,
                project=project.id,
            ).get()
            assert setting.value == NotificationSettingOptionValues.NEVER
