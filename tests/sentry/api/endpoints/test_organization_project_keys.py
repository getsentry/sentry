from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.testutils.cases import APITestCase


class OrganizationProjectKeysTest(APITestCase):
    endpoint = "sentry-api-0-organization-project-keys"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_superuser=False)
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def _get_public_keys(self, response):
        return {item["public"] for item in response.data}

    def _create_key(self, project):
        return ProjectKey.objects.get_or_create(project=project)[0]

    def test_retrieving_all_keys(self) -> None:
        """Test retrieving all keys for an organization"""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        key1 = self._create_key(project1)
        key2 = self._create_key(project2)
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 2
        assert self._get_public_keys(response) == {key1.public_key, key2.public_key}

    def test_filter_by_team_slug(self) -> None:
        """Test filtering keys by team"""
        team1 = self.create_team(organization=self.organization, members=[self.user])
        team2 = self.create_team(organization=self.organization, members=[self.user])
        project1 = self.create_project(organization=self.organization, teams=[team1])
        project2 = self.create_project(organization=self.organization, teams=[team2])
        project3 = self.create_project(organization=self.organization, teams=[team1, team2])
        key1 = self._create_key(project1)
        key2 = self._create_key(project2)
        key3 = self._create_key(project3)

        # Filter by team1 - should get project1 and project3 keys
        response = self.get_success_response(self.organization.slug, qs_params={"team": team1.slug})
        assert len(response.data) == 2
        assert self._get_public_keys(response) == {key1.public_key, key3.public_key}

        # Filter by team2 - should get project2 and project3 keys
        response = self.get_success_response(self.organization.slug, qs_params={"team": team2.slug})
        assert len(response.data) == 2
        assert self._get_public_keys(response) == {key2.public_key, key3.public_key}

    def test_filter_by_team_id(self) -> None:
        """Test filtering keys by team ID"""
        team = self.create_team(organization=self.organization, members=[self.user])
        project = self.create_project(organization=self.organization, teams=[team])
        key = self._create_key(project)
        response = self.get_success_response(
            self.organization.slug, qs_params={"team": str(team.id)}
        )
        assert len(response.data) == 1
        assert response.data[0]["public"] == key.public_key

    def test_team_not_found(self) -> None:
        """Test that invalid team returns 404"""
        response = self.get_error_response(
            self.organization.slug, qs_params={"team": "nonexistent-team"}, status_code=404
        )
        assert "Team not found" in response.data["detail"]

    def test_filter_by_status_active(self) -> None:
        """Test filtering keys by active status"""
        project = self.create_project(organization=self.organization)
        active_key = self._create_key(project)
        ProjectKey.objects.create(project=project, status=ProjectKeyStatus.INACTIVE)
        response = self.get_success_response(self.organization.slug, qs_params={"status": "active"})
        assert len(response.data) == 1
        assert response.data[0]["public"] == active_key.public_key

    def test_filter_by_status_inactive(self) -> None:
        """Test filtering keys by inactive status"""
        project = self.create_project(organization=self.organization)
        self._create_key(project)  # active
        inactive_key = ProjectKey.objects.create(project=project, status=ProjectKeyStatus.INACTIVE)
        response = self.get_success_response(
            self.organization.slug, qs_params={"status": "inactive"}
        )
        assert len(response.data) == 1
        assert response.data[0]["public"] == inactive_key.public_key

    def test_combined_filters(self) -> None:
        """Test combining team and status filters"""
        team = self.create_team(organization=self.organization, members=[self.user])
        project = self.create_project(organization=self.organization, teams=[team])
        active_key = self._create_key(project)
        ProjectKey.objects.create(project=project, status=ProjectKeyStatus.INACTIVE)
        response = self.get_success_response(
            self.organization.slug, qs_params={"team": team.slug, "status": "active"}
        )
        assert len(response.data) == 1
        assert response.data[0]["public"] == active_key.public_key

    def test_no_projects(self) -> None:
        """Test that empty organization returns empty list"""
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_permission_check(self) -> None:
        """Test that users only see keys for projects they have access to"""
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        self._create_key(other_project)
        self.get_error_response(other_org.slug, status_code=403)

    def test_multiple_keys_per_project(self) -> None:
        """Test that multiple keys per project are all returned"""
        project = self.create_project(organization=self.organization)
        key1 = self._create_key(project)
        key2 = ProjectKey.objects.create(project=project)
        key3 = ProjectKey.objects.create(project=project)
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 3
        assert self._get_public_keys(response) == {
            key1.public_key,
            key2.public_key,
            key3.public_key,
        }
