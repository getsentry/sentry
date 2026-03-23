from sentry.testutils.cases import APITestCase, SnubaTestCase


class GroupFirstLastTest(APITestCase, SnubaTestCase):
    def test_simple(self) -> None:
        self.login_as(user=self.user)
        group = self.create_group()
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"] is None
        assert response.data["lastRelease"] is None

        event = self.store_event(data={"release": "1.0"}, project_id=self.project.id)
        group = event.group

        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0"
        assert response.data["lastRelease"]["version"] == "1.0"

    def test_with_environment_filtering(self) -> None:
        self.login_as(user=self.user)

        self.create_environment(name="production", project=self.project)
        self.create_environment(name="staging", project=self.project)

        prod_event = self.store_event(
            data={"release": "1.0.0", "environment": "production"}, project_id=self.project.id
        )
        staging_event = self.store_event(
            data={"release": "1.1.0", "environment": "staging"}, project_id=self.project.id
        )

        assert prod_event.group == staging_event.group
        group = prod_event.group

        # Without the environment filter, we should return the first and last across all environments
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0.0"
        assert response.data["lastRelease"]["version"] == "1.1.0"

        # Test with production environment filter
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/?environment=production"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0.0"
        assert response.data["lastRelease"]["version"] == "1.0.0"

        # Test with staging environment filter
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/?environment=staging"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.1.0"
        assert response.data["lastRelease"]["version"] == "1.1.0"

        # Test with multiple environment filters
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/?environment=production&environment=staging"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.0.0"
        assert response.data["lastRelease"]["version"] == "1.1.0"

        # Test with staging environment filter, after a new event is created
        staging_event_2 = self.store_event(
            data={"release": "1.2.0", "environment": "staging"}, project_id=self.project.id
        )
        assert staging_event_2.group == group
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/?environment=staging"
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        assert response.data["firstRelease"]["version"] == "1.1.0"
        assert response.data["lastRelease"]["version"] == "1.2.0"

    def test_with_nonexistent_environment(self) -> None:
        self.login_as(user=self.user)
        event = self.store_event(
            data={"release": "1.0.0", "environment": "production"}, project_id=self.project.id
        )
        group = event.group

        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/first-last-release/?environment=nonexistent"
        response = self.client.get(url)
        assert response.status_code == 404, response.content
        assert response.data["detail"] == "The requested resource does not exist"
