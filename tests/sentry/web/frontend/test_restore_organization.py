from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Organization, OrganizationStatus
from sentry.testutils import TestCase, PermissionTestCase


class RestoreOrganizationPermissionTest(PermissionTestCase):
    def setUp(self):
        super(RestoreOrganizationPermissionTest, self).setUp()
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


class RemoveOrganizationTest(TestCase):
    def setUp(self):
        super(RemoveOrganizationTest, self).setUp()

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
