from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectOwnershipEndpointTestCase(APITestCase):
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
        }

    def test_update(self):
        resp = self.client.put(self.path, {"raw": "*.js admin@localhost #tiger-team"})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is True
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None

        resp = self.client.put(self.path, {"fallthrough": False})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is False
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None

        resp = self.client.put(self.path, {"raw": "..."})
        assert resp.status_code == 400

        resp = self.client.put(self.path, {"autoAssignment": True})
        assert resp.status_code == 200
        assert resp.data["fallthrough"] is False
        assert resp.data["autoAssignment"] is True
        assert resp.data["raw"] == "*.js admin@localhost #tiger-team"
        assert resp.data["dateCreated"] is not None
        assert resp.data["lastUpdated"] is not None

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
