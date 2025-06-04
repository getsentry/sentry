from unittest import mock

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.projectownership import ProjectOwnership
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class ProjectOwnershipEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-ownership"
    method = "put"

    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.member_user = self.create_user("member@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user, organization=self.organization, role="member", teams=[self.team]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

        self.path = reverse(
            "sentry-api-0-project-ownership",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    def test_empty_state(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {
            "raw": None,
            "fallthrough": True,
            "autoAssignment": "Auto Assign to Issue Owner",
            "isActive": True,
            "dateCreated": None,
            "lastUpdated": None,
            "codeownersAutoSync": True,
            "schema": None,
        }

    def test_update(self):
        resp = self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is True
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"fallthrough": False})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"raw": "..."})
        assert resp.status_code == 400

        resp = self.client.put(self.path, {"autoAssignment": "Auto Assign to Issue Owner"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"codeownersAutoSync": False})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is False

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"

        resp = self.client.put(self.path, {"autoAssignment": "Turn off Auto-Assignment"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Turn off Auto-Assignment"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is False

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["autoAssignment"] == "Turn off Auto-Assignment"

        # Test that we can reset autoAssignment for updating in non-UI use case
        resp = self.client.put(self.path, {"autoAssignment": "Turn off Auto-Assignment"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] == "Turn off Auto-Assignment"
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is False

    def test_audit_log_entry(self):
        with outbox_runner():
            resp = self.client.put(self.path, {"autoAssignment": "Auto Assign to Issue Owner"})
        assert resp.status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL):
            auditlog = AuditLogEntry.objects.filter(
                organization_id=self.project.organization.id,
                event=audit_log.get_event_id("PROJECT_OWNERSHIPRULE_EDIT"),
                target_object=self.project.id,
            )
        assert len(auditlog) == 1
        assert "Auto Assign to Issue Owner" in auditlog[0].data["autoAssignment"]

    def test_audit_log_ownership_change(self):
        with outbox_runner():
            resp = self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        assert resp.status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL):
            auditlog = AuditLogEntry.objects.filter(
                organization_id=self.project.organization.id,
                event=audit_log.get_event_id("PROJECT_OWNERSHIPRULE_EDIT"),
                target_object=self.project.id,
            )
        assert len(auditlog) == 1
        assert "modified" in auditlog[0].data["ownership_rules"]

    def test_update_schema(self):
        resp = self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        assert resp.data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "path", "pattern": "*.js"},
                    "owners": [
                        {"type": "user", "identifier": "admin@localhost", "id": self.user.id},
                        {"type": "team", "identifier": "tiger-team", "id": self.team.id},
                    ],
                }
            ],
        }

    def test_get(self):
        self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        resp = self.client.get(self.path)
        assert "schema" in resp.data.keys()
        assert resp.data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "path", "pattern": "*.js"},
                    "owners": [
                        {"type": "user", "id": self.user.id, "name": "admin@localhost"},
                        {"type": "team", "id": self.team.id, "name": "tiger-team"},
                    ],
                }
            ],
        }

        # Assert that "identifier" is not renamed to "name" in the backend
        ownership = ProjectOwnership.objects.get(project=self.project)
        assert ownership.schema is not None
        assert ownership.schema["rules"] == [
            {
                "matcher": {"type": "path", "pattern": "*.js"},
                "owners": [
                    {"type": "user", "identifier": "admin@localhost", "id": self.user.id},
                    {"type": "team", "identifier": "tiger-team", "id": self.team.id},
                ],
            }
        ]

    def test_get_empty_schema(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {
            "raw": None,
            "fallthrough": True,
            "autoAssignment": "Auto Assign to Issue Owner",
            "isActive": True,
            "dateCreated": None,
            "lastUpdated": None,
            "codeownersAutoSync": True,
            "schema": None,
        }

    def test_get_schema_empty_raw(self):
        # Create ProjectOwnership...
        self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        # ...then remove its contents
        self.client.put(self.path, {"raw": ""})
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        expected_data = {
            "raw": None,
            "fallthrough": True,
            "autoAssignment": "Auto Assign to Issue Owner",
            "isActive": True,
            "codeownersAutoSync": True,
            "schema": None,
        }
        for k in expected_data:
            assert expected_data[k] == resp.data[k]
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None

    def test_get_rule_deleted_owner(self):
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.client.put(self.path, {"raw": "*.js member_delete@localhost #tiger-team"})

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.member_user_delete.delete()
        resp = self.client.get(self.path)
        assert resp.data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "path", "pattern": "*.js"},
                    "owners": [{"type": "team", "name": "tiger-team", "id": self.team.id}],
                }
            ],
        }

    def test_get_no_rule_deleted_owner(self):
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.client.put(self.path, {"raw": "*.js member_delete@localhost"})

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.member_user_delete.delete()

        resp = self.client.get(self.path)
        assert resp.data["schema"] == {"$version": 1, "rules": []}

    def test_get_multiple_rules_deleted_owners(self):
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.member_user_delete2 = self.create_user("member_delete2@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete2,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.client.put(
            self.path,
            {
                "raw": "*.js member_delete@localhost\n*.py #tiger-team\n*.css member_delete2@localhost\n*.rb member@localhost"
            },
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.member_user_delete.delete()
            self.member_user_delete2.delete()

        resp = self.client.get(self.path)
        assert resp.data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "*.py", "type": "path"},
                    "owners": [{"id": self.team.id, "name": "tiger-team", "type": "team"}],
                },
                {
                    "matcher": {"pattern": "*.rb", "type": "path"},
                    "owners": [
                        {"id": self.member_user.id, "name": "member@localhost", "type": "user"}
                    ],
                },
            ],
        }

    def test_invalid_email(self):
        resp = self.client.put(self.path, {"raw": "*.js idont@exist.com #tiger-team"})
        assert resp.status_code == 400
        assert resp.data == {"raw": ["Invalid rule owners: idont@exist.com"]}

    def test_invalid_team(self):
        resp = self.client.put(self.path, {"raw": "*.js admin@localhost #faketeam"})
        assert resp.status_code == 400
        assert resp.data == {"raw": ["Invalid rule owners: #faketeam"]}

    def test_invalid_mixed(self):
        resp = self.client.put(
            self.path, {"raw": "*.js idont@exist.com admin@localhost #faketeam #tiger-team"}
        )
        assert resp.status_code == 400
        assert resp.data == {"raw": ["Invalid rule owners: #faketeam, idont@exist.com"]}

    def test_invalid_matcher_type(self):
        """Check for matcher types that aren't allowed when updating issue owners"""

        # Codeowners cannot be added by modifying issue owners
        resp = self.client.put(self.path, {"raw": "codeowners:*.js admin@localhost #tiger-team"})
        assert resp.status_code == 400
        assert resp.data == {
            "raw": ["Codeowner type paths can only be added by importing CODEOWNER files"]
        }

    def test_max_raw_length(self):
        new_raw = f"*.py admin@localhost #{self.team.slug}"
        with mock.patch("sentry.api.endpoints.project_ownership.DEFAULT_MAX_RAW_LENGTH", 10):
            resp = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                raw=new_raw,
            )
            assert resp.data == {
                "raw": [
                    ErrorDetail(string="Raw needs to be <= 10 characters in length", code="invalid")
                ],
            }

        # Test that we allow this to be modified for existing large rows
        ownership = ProjectOwnership.objects.create(
            project=self.project,
            raw=f"*.py test@localhost #{self.team.slug}",
        )
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            raw=new_raw,
        )
        ownership.refresh_from_db()
        assert ownership.raw == new_raw

    def test_update_by_member(self):
        self.login_as(user=self.member_user)

        resp = self.client.put(self.path, {"raw": "*.js member@localhost #tiger-team"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is True
        assert resp.data["autoAssignment"] == "Auto Assign to Issue Owner"
        assert resp.data["raw"] == "*.js member@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

    def test_update_by_member_denied(self):
        self.login_as(user=self.member_user)

        resp = self.client.put(self.path, {"fallthrough": False})
        assert resp.status_code == 403
