from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import APITestCase


class OrganizationAuditLogsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        org2 = self.create_organization(owner=self.user, name='baz')

        entry1 = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
        )
        entry2 = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
        )
        AuditLogEntry.objects.create(
            organization=org2,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
        )

        url = reverse('sentry-api-0-organization-audit-logs', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(entry2.id)
        assert response.data[1]['id'] == str(entry1.id)
