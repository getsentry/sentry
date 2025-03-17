from django.utils import timezone

from sentry import audit_log
from sentry.api.serializers import AuditLogEntrySerializer, serialize
from sentry.models.auditlogentry import AuditLogEntry
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuditLogEntrySerializerTest(TestCase):
    def test_simple(self):
        datetime = timezone.now()
        log = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("TEAM_ADD"),
            actor=self.user,
            datetime=datetime,
            data={"slug": "New Team"},
        )

        serializer = AuditLogEntrySerializer()
        result = serialize(log, serializer=serializer)

        assert result["event"] == "team.create"
        assert result["actor"]["username"] == self.user.username
        assert result["dateCreated"] == datetime
        assert result["data"] == {"slug": "New Team"}

    def test_data_field_filtering(self):
        """Test that only allowed fields are present in the data field"""
        log = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            actor=self.user,
            datetime=timezone.now(),
            data={
                "id": "123",
                "slug": "project-slug",
                "old_slug": "old-slug",
                "new_slug": "new-slug",
                "name": "Project Name",
                "sensitive_field": "should_not_appear",
                "another_field": "should_not_appear",
            },
        )

        serializer = AuditLogEntrySerializer()
        result = serialize(log, serializer=serializer)

        # Check that only allowed fields are present
        allowed_fields = {"id", "slug", "old_slug", "new_slug", "name"}
        assert set(result["data"].keys()) == allowed_fields
        assert "sensitive_field" not in result["data"]
        assert "another_field" not in result["data"]

    def test_data_field_empty_when_no_required_fields(self):
        """Test that data field is empty when none of the required fields are present"""
        log = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            actor=self.user,
            datetime=timezone.now(),
            data={
                "unrequired_field1": "value1",
                "unrequired_field2": "value2",
            },
        )

        serializer = AuditLogEntrySerializer()
        result = serialize(log, serializer=serializer)

        assert result["data"] == {}

    def test_scim_logname(self):
        uuid_prefix = "681d6e"
        user = self.create_user(
            username=f"scim-internal-integration-{uuid_prefix}-ad37e179-501c-4639-bc83-9780ca1",
            email="",
        )
        log = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("TEAM_REMOVE"),
            actor=user,
            datetime=timezone.now(),
            data={"slug": "Old Team"},
        )

        serializer = AuditLogEntrySerializer()
        result = serialize(log, serializer=serializer)

        assert result["actor"]["name"] == f"SCIM Internal Integration ({uuid_prefix})"

    def test_invalid_template(self):
        log = AuditLogEntry.objects.create(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("MEMBER_INVITE"),
            actor=self.user,
            datetime=timezone.now(),
            data={},  # missing required keys
        )

        serializer = AuditLogEntrySerializer()
        result = serialize(log, serializer=serializer)
        assert result["note"] == ""
