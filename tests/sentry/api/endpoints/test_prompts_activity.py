from django.urls import reverse

from sentry.testutils.cases import APITestCase


class PromptsActivityTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal-Elephant-Giraffe-Tree-House"
        )
        self.path = reverse("sentry-api-0-organization-prompts-activity", args=[self.org.slug])

    def test_organization_permissions(self) -> None:
        new_org = self.create_organization()
        self.path = reverse("sentry-api-0-organization-prompts-activity", args=[new_org.slug])
        resp = self.client.put(
            self.path,
            {
                "organization_id": new_org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )

        assert resp.status_code == 403

    def test_organization_id_mismatch(self) -> None:
        new_org = self.create_organization()
        resp = self.client.put(
            self.path,
            {
                "organization_id": new_org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == "Organization missing or mismatched"

    def test_invalid_feature(self) -> None:
        # Invalid feature prompt name
        resp = self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "gibberish",
                "status": "dismissed",
            },
        )

        assert resp.status_code == 400

    def test_batched_invalid_feature(self) -> None:
        # Invalid feature prompt name
        resp = self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": ["releases", "gibberish"],
                "status": "dismissed",
            },
        )

        assert resp.status_code == 400

    def test_invalid_project(self) -> None:
        # Invalid project id
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        self.project.delete()
        # project doesn't exist
        resp = self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )
        assert resp.status_code == 400
        assert resp.data["detail"] == "Project does not belong to this organization"

    def test_dismiss(self) -> None:
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data.get("data", None) is None

        resp = self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )
        assert resp.status_code == 201

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert "data" in resp.data
        assert "dismissed_ts" in resp.data["data"]

    def test_dismiss_str_id(self) -> None:
        resp = self.client.put(
            self.path,
            {
                "organization_id": str(self.org.id),
                "project_id": str(self.project.id),
                "feature": "releases",
                "status": "dismissed",
            },
        )
        assert resp.status_code == 201, resp.content

        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data
        assert "data" in resp.data
        assert "dismissed_ts" in resp.data["data"]

    def test_snooze(self) -> None:
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data.get("data", None) is None

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "snoozed",
            },
        )

        resp = self.client.get(self.path, data)

        assert resp.status_code == 200
        assert "data" in resp.data
        assert "snoozed_ts" in resp.data["data"]

    def test_visible(self) -> None:
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data.get("data", None) is None

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "visible",
            },
        )

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert "data" in resp.data
        assert resp.data["data"].get("dismissed_ts") is None
        assert resp.data["data"].get("snoozed_ts") is None

    def test_visible_after_dismiss(self) -> None:
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": "releases",
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data.get("data", None) is None

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismiss",
            },
        )

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "visible",
            },
        )

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert "data" in resp.data
        assert resp.data["data"].get("dismissed_ts") is None
        assert resp.data["data"].get("snoozed_ts") is None

    def test_batched(self) -> None:
        data = {
            "organization_id": self.org.id,
            "project_id": self.project.id,
            "feature": ["releases", "alert_stream"],
        }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data["features"].get("releases", None) is None
        assert resp.data["features"].get("alert_stream", None) is None

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert "dismissed_ts" in resp.data["features"]["releases"]
        assert resp.data["features"].get("alert_stream", None) is None

        self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": self.project.id,
                "feature": "alert_stream",
                "status": "snoozed",
            },
        )

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert "dismissed_ts" in resp.data["features"]["releases"]
        assert "snoozed_ts" in resp.data["features"]["alert_stream"]

    def test_project_from_different_organization(self) -> None:
        """
        Test that users cannot dismiss prompts for projects in other organizations.
        
        This is a regression test for an IDOR vulnerability where the endpoint only
        checked if a project existed, but didn't verify it belonged to the user's org.
        
        @markstory - When adding similar endpoints in the future, always remember to scope
        queries by organization_id. The pattern should be:
            Project.objects.filter(id=project_id, organization_id=org_id)
        not just:
            Project.objects.filter(id=project_id)
        """
        other_org = self.create_organization(name="other_org")
        other_project = self.create_project(organization=other_org, name="other_project")

        # Try to dismiss a prompt using a project from a different organization
        resp = self.client.put(
            self.path,
            {
                "organization_id": self.org.id,
                "project_id": other_project.id,
                "feature": "releases",
                "status": "dismissed",
            },
        )

        # Should fail because project doesn't belong to the organization
        assert resp.status_code == 400
        assert resp.data["detail"] == "Project does not belong to this organization"
