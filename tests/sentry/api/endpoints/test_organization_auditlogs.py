from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ErrorDetail

from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import APITestCase


class OrganizationAuditLogsTest(APITestCase):
    endpoint = "sentry-api-0-organization-audit-logs"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        now = timezone.now()

        org2 = self.create_organization(owner=self.user)

        entry1 = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )
        entry2 = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now + timedelta(seconds=1),
        )
        AuditLogEntry.objects.create(
            organization=org2, event=AuditLogEntryEvent.ORG_EDIT, actor=self.user, datetime=now
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(entry2.id)
        assert response.data[1]["id"] == str(entry1.id)

    def test_filter_by_event(self):
        now = timezone.now()

        entry1 = AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )
        AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_ADD,
            actor=self.user,
            datetime=now + timedelta(seconds=1),
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"event": "org.edit"}
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(entry1.id)

    def test_filter_by_user(self):
        now = timezone.now()

        org = self.create_organization(owner=self.user)

        user2 = self.create_user()

        self.create_member(user=user2, organization=self.organization)

        entry1 = AuditLogEntry.objects.create(
            organization=org, event=AuditLogEntryEvent.ORG_EDIT, actor=self.user, datetime=now
        )
        AuditLogEntry.objects.create(
            organization=org, event=AuditLogEntryEvent.ORG_EDIT, actor=user2, datetime=now
        )

        response = self.get_success_response(org.slug, qs_params={"actor": self.user.id})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(entry1.id)

    def test_filter_by_user_and_event(self):
        now = timezone.now()

        org = self.create_organization(owner=self.user)

        user2 = self.create_user()

        self.create_member(user=user2, organization=self.organization)

        entry1 = AuditLogEntry.objects.create(
            organization=org, event=AuditLogEntryEvent.ORG_EDIT, actor=self.user, datetime=now
        )
        AuditLogEntry.objects.create(
            organization=org, event=AuditLogEntryEvent.ORG_EDIT, actor=user2, datetime=now
        )
        AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_ADD,
            actor=self.user,
            datetime=now + timedelta(seconds=1),
        )

        response = self.get_success_response(
            org.slug, qs_params={"event": "org.edit", "actor": self.user.id}
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(entry1.id)

    def test_invalid_event(self):
        now = timezone.now()

        AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )

        response = self.get_error_response(
            self.organization.slug, qs_params={"event": "wrong"}, status_code=400
        )
        assert response.data == {"event": ["Invalid audit log event"]}

    def test_user_out_of_bounds(self):
        now = timezone.now()

        AuditLogEntry.objects.create(
            organization=self.organization,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
            datetime=now,
        )

        response = self.get_error_response(
            self.organization.slug, qs_params={"actor": 111111111111}, status_code=400
        )
        assert response.data == {
            "actor": [
                ErrorDetail(
                    string="Ensure this value is less than or equal to 2147483647.",
                    code="max_value",
                )
            ]
        }
