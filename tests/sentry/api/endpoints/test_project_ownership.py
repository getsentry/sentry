from unittest import mock

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models import ProjectOwnership
from sentry.testutils import APITestCase


class ProjectOwnershipEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-ownership"
    method = "put"

    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

        self.path = reverse(
            "sentry-api-0-project-ownership",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

    def test_empty_state(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {
            "raw": None,
            "fallthrough": True,
            "autoAssignment": False,
            "isActive": True,
            "dateCreated": None,
            "lastUpdated": None,
            "codeownersAutoSync": True,
        }

    def test_update(self):
        resp = self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is True
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"fallthrough": False})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"raw": "..."})
        assert resp.status_code == 400

        resp = self.client.put(self.path, {"autoAssignment": True})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is True
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is True

        resp = self.client.put(self.path, {"codeownersAutoSync": False})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is True
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None
        assert resp.data["codeownersAutoSync"] is False

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["autoAssignment"] is True

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
        with mock.patch("sentry.api.endpoints.project_ownership.MAX_RAW_LENGTH", 10):
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
