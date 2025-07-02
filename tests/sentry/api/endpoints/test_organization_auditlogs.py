from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationAuditLogsTest(APITestCase):
    endpoint = "sentry-api-0-organization-audit-logs"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        now = timezone.now()

        org2 = self.create_organization(owner=self.user)

        entry1 = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )
        entry2 = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now + timedelta(seconds=1),
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=org2.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )

        response = self.get_success_response(self.organization.slug)
        assert len(response.data["rows"]) == 2
        assert response.data["rows"][0]["id"] == str(entry2.id)
        assert response.data["rows"][1]["id"] == str(entry1.id)

    def test_filter_by_event(self):
        now = timezone.now()

        entry1 = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_ADD"),
            actor=self.user,
            datetime=now + timedelta(seconds=1),
            data={"thing": "to True"},
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"event": "org.edit"}
        )
        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["id"] == str(entry1.id)

    def test_filter_by_user(self):
        now = timezone.now()

        org = self.create_organization(owner=self.user)

        user2 = self.create_user()

        self.create_member(user=user2, organization=self.organization)

        entry1 = AuditLogEntry.objects.create(
            organization_id=org.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=org.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=user2,
            datetime=now,
            data={"thing": "to True"},
        )

        response = self.get_success_response(org.slug, qs_params={"actor": self.user.id})
        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["id"] == str(entry1.id)

    def test_filter_by_user_and_event(self):
        now = timezone.now()

        org = self.create_organization(owner=self.user)

        user2 = self.create_user()

        self.create_member(user=user2, organization=self.organization)

        entry1 = AuditLogEntry.objects.create(
            organization_id=org.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=org.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=user2,
            datetime=now,
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=org.id,
            event=audit_log.get_event_id("ORG_ADD"),
            actor=self.user,
            datetime=now + timedelta(seconds=1),
            data={"thing": "to True"},
        )

        response = self.get_success_response(
            org.slug, qs_params={"event": "org.edit", "actor": self.user.id}
        )
        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["id"] == str(entry1.id)

    def test_invalid_event(self):
        now = timezone.now()

        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )

        response = self.get_success_response(self.organization.slug, qs_params={"event": "wrong"})
        assert response.data["rows"] == []

    def test_user_out_of_bounds(self):
        now = timezone.now()

        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
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

    def test_options_data_included(self):
        now = timezone.now()

        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )
        audit_log_api_names = set(audit_log.get_api_names())

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2
        assert set(response.data["options"]) == audit_log_api_names

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_write_can_see_audit_logs(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=timezone.now(),
            data={"thing": "to True"},
        )
        self.get_success_response(self.organization.slug)

        self.add_user_permission(superuser, "superuser.write")
        self.get_success_response(self.organization.slug)

    def test_filter_by_date(self):
        now = timezone.now()

        entry1 = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now - timedelta(days=1),
            data={"thing": "to True"},
        )
        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_ADD"),
            actor=self.user,
            datetime=now,
            data={"thing": "to True"},
        )

        start_time = now - timedelta(days=1)
        end_time = now - timedelta(hours=1)

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "event": "org.edit",
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
        )
        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["id"] == str(entry1.id)

    def test_filter_by_stats_period(self):
        now = timezone.now()

        # old entry
        AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            actor=self.user,
            datetime=now - timedelta(days=2),
            data={"thing": "to True"},
        )

        recent_entry = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("ORG_ADD"),
            actor=self.user,
            datetime=now - timedelta(hours=12),
            data={"thing": "to True"},
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"statsPeriod": "1d"}
        )

        # Should only return the recent entry, not the old one
        assert len(response.data["rows"]) == 1
        assert response.data["rows"][0]["id"] == str(recent_entry.id)
