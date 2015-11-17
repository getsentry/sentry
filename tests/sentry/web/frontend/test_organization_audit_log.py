from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationAuditLogPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuditLogPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-audit-log', args=[self.organization.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class OrganizationAuditLogTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-organization-audit-log', args=[organization.slug])

        AuditLogEntry.objects.create(
            organization=organization,
            actor=self.user,
            event=AuditLogEntryEvent.ORG_ADD,
        )

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-audit-log.html')

        assert resp.context['organization'] == organization
        assert len(resp.context['audit_log_queryset']) == 1
