from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DataForwardingDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-forwarding-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class DataForwardingDetailsPutTest(DataForwardingDetailsEndpointTest):
    method = "PUT"

    def test_update_data_forwarder(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
            "is_enabled": False,
            "enroll_new_projects": True,
            "project_ids": [self.project.id],
        }

        response = self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        assert response.data["config"] == {"write_key": "new_key"}
        assert response.data["isEnabled"] is False
        assert response.data["enrollNewProjects"] is True

        data_forwarder.refresh_from_db()
        assert data_forwarder.config == {"write_key": "new_key"}
        assert data_forwarder.is_enabled is False
        assert data_forwarder.enroll_new_projects is True

    def test_update_with_project_ids(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        DataForwarderProject.objects.create(
            data_forwarder=data_forwarder, project=project1, is_enabled=True
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [project2.id, project3.id],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_projects = set(
            DataForwarderProject.objects.filter(data_forwarder=data_forwarder).values_list(
                "project_id", flat=True
            )
        )
        assert enrolled_projects == {project2.id, project3.id}
        assert project1.id not in enrolled_projects

    def test_update_unenroll_all_projects(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project1, is_enabled=True
        )
        DataForwarderProject.objects.create(
            data_forwarder=data_forwarder, project=project2, is_enabled=True
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_count = DataForwarderProject.objects.filter(data_forwarder=data_forwarder).count()
        assert enrolled_count == 0

    def test_update_with_invalid_project_ids(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [99999, 88888],  # Invalid project IDs
        }

        response = self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=400, **payload
        )
        assert "invalid project ids" in str(response.data).lower()

    def test_update_with_project_write_only(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload = {
            "project_ids": [project1.id, project2.id],
            "overrides": {"custom": "value"},
            "is_enabled": True,
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config1 = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project1
        )
        assert project_config1.overrides == {"custom": "value"}
        assert project_config1.is_enabled is True

        project_config2 = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project2
        )
        assert project_config2.overrides == {"custom": "value"}
        assert project_config2.is_enabled is True

    def test_update_project_overrides_with_project_write(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

        DataForwarderProject.objects.create(
            data_forwarder=data_forwarder,
            project=project,
            is_enabled=True,
            overrides={"old": "value"},
        )

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload = {
            "project_ids": [project.id],
            "overrides": {"new": "value"},
            "is_enabled": False,
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project
        )
        assert project_config.overrides == {"new": "value"}
        assert project_config.is_enabled is False

    def test_update_unenroll_projects_with_project_write(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project1, is_enabled=True
        )
        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project2, is_enabled=True
        )

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload: dict[str, list[int]] = {"project_ids": []}

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_count = DataForwarderProject.objects.filter(data_forwarder=data_forwarder).count()
        assert enrolled_count == 0

    def test_update_with_project_write_checks_permissions(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)

        project1 = self.create_project(organization=self.organization, teams=[team1])
        project2 = self.create_project(organization=self.organization, teams=[team2])

        # User only has access to team1
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[team1],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload = {"project_ids": [project1.id, project2.id]}

        response = self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=403, **payload
        )
        assert "insufficient access" in str(response.data).lower()

    def test_update_requires_permission(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        user_without_permission = self.create_user()
        self.login_as(user=user_without_permission)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
        }

        self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=403, **payload
        )


@region_silo_test
class DataForwardingDetailsDeleteTest(DataForwardingDetailsEndpointTest):
    method = "DELETE"

    def test_delete_data_forwarder(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project1, is_enabled=True
        )
        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project2, is_enabled=True
        )

        self.get_success_response(self.organization.slug, data_forwarder.id, status_code=204)

        assert not DataForwarder.objects.filter(id=data_forwarder.id).exists()

        assert not DataForwarderProject.objects.filter(data_forwarder_id=data_forwarder.id).exists()

    def test_delete_requires_permission(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        user_without_permission = self.create_user()
        self.login_as(user=user_without_permission)

        self.get_error_response(self.organization.slug, data_forwarder.id, status_code=403)

        assert DataForwarder.objects.filter(id=data_forwarder.id).exists()

    def test_delete_nonexistent_data_forwarder(self) -> None:
        self.get_error_response(self.organization.slug, 99999, status_code=404)
