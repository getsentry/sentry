from __future__ import absolute_import

import six

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import APITestCase


class OrganizationAuditLogsTest(APITestCase):
    def test_simple(self):
        now = timezone.now()

        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        org2 = self.create_organization(owner=self.user, name='baz')

        entry1 = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )
        entry2 = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now + timedelta(seconds=1),
        )
        AuditLogEntry.objects.create(
            organization=org2,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )

        url = reverse('sentry-api-0-organization-audit-logs', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == six.text_type(entry2.id)
        assert response.data[1]['id'] == six.text_type(entry1.id)
