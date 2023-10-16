from django.urls import reverse

from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.services.hybrid_cloud.organization.serial import serialize_rpc_organization
from sentry.silo import SiloMode
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils.cases import PermissionTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test(stable=True)
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


@region_silo_test(stable=True)
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

        assert resp.context["deleting_organization"] == serialize_rpc_organization(
            self.organization
        )
        assert resp.context["pending_deletion"] is True

        self.organization.update(status=OrganizationStatus.DELETION_IN_PROGRESS)

        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, "sentry/restore-organization.html")

        assert resp.context["deleting_organization"] == serialize_rpc_organization(
            self.organization
        )
        assert resp.context["pending_deletion"] is False

    def test_renders_with_context_customer_domain(self):
        path = reverse("sentry-customer-domain-restore-organization")

        resp = self.client.get(path, SERVER_NAME=f"{self.organization.slug}.testserver")

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, "sentry/restore-organization.html")

        assert resp.context["deleting_organization"] == serialize_rpc_organization(
            self.organization
        )
        assert resp.context["pending_deletion"] is True

        self.organization.update(status=OrganizationStatus.DELETION_IN_PROGRESS)

        resp = self.client.get(path, SERVER_NAME=f"{self.organization.slug}.testserver")

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, "sentry/restore-organization.html")

        assert resp.context["deleting_organization"] == serialize_rpc_organization(
            self.organization
        )
        assert resp.context["pending_deletion"] is False

    def test_success(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 302

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.ACTIVE

    def test_too_late_still_restores(self):
        self.organization.update(status=OrganizationStatus.DELETION_IN_PROGRESS)

        resp = self.client.post(self.path)

        assert resp.status_code == 302

        org = Organization.objects.get(id=self.organization.id)

        assert org.status == OrganizationStatus.ACTIVE

    def test_org_already_deleted(self):
        assert RegionScheduledDeletion.objects.count() == 0

        org_id = self.organization.id
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)
        deletion = RegionScheduledDeletion.schedule(self.organization, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(id=org_id).count() == 0

        with assume_test_silo_mode(SiloMode.CONTROL):
            resp = self.client.post(self.path, follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [("/auth/login/", 302), ("/organizations/new/", 302)]
        assert Organization.objects.filter(id=org_id).count() == 0
