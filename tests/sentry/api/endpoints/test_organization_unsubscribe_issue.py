from sentry.models.groupsubscription import GroupSubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.linksign import generate_signed_link


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
        assert resp.data["slug"] is None

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
