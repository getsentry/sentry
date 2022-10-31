from django.urls import reverse

from sentry.models import Organization, OrganizationStatus, ScheduledDeletion
from sentry.tasks.deletion import run_deletion
from sentry.testutils import PermissionTestCase, TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RestoreOrganizationPermissionTest(PermissionTestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(
            name="foo", owner=self.user, status=OrganizationStatus.PENDING_DELETION
        )
        self.path = reverse("sentry-restore-organization", args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        self.assert_team_admin_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


@region_silo_test
class RemoveOrganizationTest(TestCase):
    def setUp(self):
        super().setUp()

        self.organization = self.create_organization(
            name="foo", owner=self.user, status=OrganizationStatus.PENDING_DELETION
        )
        self.team = self.create_team(organization=self.organization)
        self.path = reverse("sentry-restore-organization", args=[self.organization.slug])

        self.login_as(self.user)

    def test_renders_with_context(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, "sentry/restore-organization.html")

        assert resp.context["deleting_organization"] == self.organization
        assert resp.context["pending_deletion"] is True

        Organization.objects.filter(id=self.organization.id).update(
            status=OrganizationStatus.DELETION_IN_PROGRESS
        )

        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, "sentry/restore-organization.html")

        assert resp.context["deleting_organization"] == self.organization
        assert resp.context["pending_deletion"] is False

    def test_success(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 302

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.VISIBLE

    def test_too_late_still_restores(self):
        Organization.objects.filter(id=self.organization.id).update(
            status=OrganizationStatus.DELETION_IN_PROGRESS
        )

        resp = self.client.post(self.path)

        assert resp.status_code == 302

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.VISIBLE

    def test_org_already_deleted(self):
        assert ScheduledDeletion.objects.count() == 0

        org_id = self.organization.id
        Organization.objects.filter(id=org_id).update(status=OrganizationStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(self.organization, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(id=org_id).count() == 0

        resp = self.client.post(self.path, follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [("/auth/login/", 302), ("/organizations/new/", 302)]
        assert Organization.objects.filter(id=org_id).count() == 0
