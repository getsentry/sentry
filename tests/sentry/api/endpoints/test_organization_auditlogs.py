from datetime import timedelta

from django.utils import timezone

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import APITestCase


class OrganizationAuditLogsTest(APITestCase):
    endpoint = "sentry-api-0-organization-audit-logs"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        now = timezone.now()

        org = self.create_organization(owner=self.user, name="baz")
        org2 = self.create_organization(owner=self.user, name="baz")

        entry1 = AuditLogEntry.objects.create(
            organization=org, event=AuditLogEntryEvent.ORG_EDIT, actor=self.user, datetime=now
        )
        entry2 = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now + timedelta(seconds=1),
        )
        AuditLogEntry.objects.create(
            organization=org2, event=AuditLogEntryEvent.ORG_EDIT, actor=self.user, datetime=now
        )

        response = self.get_success_response(org.slug)
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(entry2.id)
        assert response.data[1]["id"] == str(entry1.id)
