from django.urls import reverse

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

    def get_response(self, *args, **kwargs):
        """
        Override get_response to always add the required feature flag.
        """
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": True,
            }
        ):
            return super().get_response(*args, **kwargs)


@region_silo_test
class DataForwardingDetailsPutTest(DataForwardingDetailsEndpointTest):
    method = "PUT"

    def test_without_revamp_feature_flag_access(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": False,
                "organizations:data-forwarding": True,
            }
        ):
            response = self.client.put(
                reverse(self.endpoint, args=(self.organization.slug, data_forwarder.id))
            )
            assert response.status_code == 403

    def test_without_data_forwarding_feature_flag_access(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": False,
            }
        ):
            response = self.client.put(
                reverse(self.endpoint, args=(self.organization.slug, data_forwarder.id))
            )
            assert response.status_code == 403

    def test_update_data_forwarder(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )

        # Verify initial state before update
        assert data_forwarder.config == {"write_key": "old_key"}
        assert data_forwarder.is_enabled

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
            "is_enabled": False,
            "enroll_new_projects": True,
            "project_ids": [self.project.id],
        }

        with self.feature({"organizations:data-forwarding-revamp-access": True}):
            response = self.get_success_response(
                self.organization.slug, data_forwarder.id, status_code=200, **payload
            )

        assert response.data["config"] == {"write_key": "new_key"}
        assert not response.data["isEnabled"]
        assert response.data["enrollNewProjects"]

        data_forwarder.refresh_from_db()
        assert data_forwarder.config == {"write_key": "new_key"}
        assert not data_forwarder.is_enabled
        assert data_forwarder.enroll_new_projects

    def test_update_reenrolls_previously_enrolled_project(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [project.id],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project
        )
        assert project_config.is_enabled

    def test_update_with_project_ids(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project1)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [project2.id, project3.id],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_projects = set(
            DataForwarderProject.objects.filter(
                data_forwarder=data_forwarder, is_enabled=True
            ).values_list("project_id", flat=True)
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

        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project1)
        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project2)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "test_key"},
            "project_ids": [],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_count = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, is_enabled=True
        ).count()
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

    def test_update_with_project_write_bulk_enrollment(self) -> None:
        """Test bulk enrollment of multiple projects by project:write user"""
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

        # Bulk enrollment only uses project_ids
        payload = {
            "project_ids": [project1.id, project2.id],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config1 = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project1
        )
        assert project_config1.is_enabled

        project_config2 = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project2
        )
        assert project_config2.is_enabled

    def test_update_project_overrides_with_project_write(self) -> None:
        """Test updating a single project's overrides and is_enabled by project:write user"""
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(
            data_forwarder=data_forwarder, project=project, overrides={"old": "value"}
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

        # Single project configuration uses project_id (singular)
        payload = {
            "project_id": project.id,
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
        assert not project_config.is_enabled

    def test_update_unenroll_projects_with_project_write(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project1)
        self.create_data_forwarder_project(data_forwarder=data_forwarder, project=project2)

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

        enrolled_count = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, is_enabled=True
        ).count()
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

    def test_update_with_missing_project_id_for_project_write(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
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

        # project:write path requires either project_ids or project_id
        payload = {
            "overrides": {"custom": "value"},
        }

        response = self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=400, **payload
        )
        assert "project_id" in str(response.data).lower()

    def test_update_with_mixed_valid_and_invalid_project_ids(self) -> None:
        """Test bulk enrollment with invalid project IDs"""
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        # Bulk enrollment should not include overrides
        payload = {
            "project_ids": [project.id, 99999],
        }

        response = self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=400, **payload
        )
        assert "invalid project ids" in str(response.data).lower()
        assert "99999" in str(response.data)

    def test_update_with_project_from_different_organization(self) -> None:
        """Test bulk enrollment rejects projects from different organization"""
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        # Create a project in a different organization
        other_org = self.create_organization(name="Other Org")
        other_project = self.create_project(organization=other_org)

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        # Bulk enrollment should not include overrides
        payload = {
            "project_ids": [other_project.id],
        }

        response = self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=400, **payload
        )
        assert "invalid project ids" in str(response.data).lower()

    def test_update_without_team_membership_denies_access(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",
            teams=[],  # No team membership
        )
        self.login_as(user=user)

        payload: dict[str, list[int]] = {
            "project_ids": [],
        }

        self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=403, **payload
        )

    def test_update_single_project_creates_new_config(self) -> None:
        """Test that single project configuration can create a new config"""
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

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
            "project_id": project.id,
            "overrides": {"custom": "value"},
            "is_enabled": True,
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project
        )
        assert project_config.overrides == {"custom": "value"}
        assert project_config.is_enabled

    def test_org_write_can_bulk_enroll(self) -> None:
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
            role="manager",  # Has org:write
        )
        self.login_as(user=user)

        payload = {
            "project_ids": [project1.id, project2.id],
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        enrolled_projects = set(
            DataForwarderProject.objects.filter(
                data_forwarder=data_forwarder, is_enabled=True
            ).values_list("project_id", flat=True)
        )
        assert enrolled_projects == {project1.id, project2.id}

    def test_org_write_can_update_project_overrides(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "test_key"},
        )

        project = self.create_project(organization=self.organization)

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="manager",  # Has org:write
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload = {
            "project_id": project.id,
            "overrides": {"custom": "value"},
            "is_enabled": True,
        }

        self.get_success_response(
            self.organization.slug, data_forwarder.id, status_code=200, **payload
        )

        project_config = DataForwarderProject.objects.get(
            data_forwarder=data_forwarder, project=project
        )
        assert project_config.overrides == {"custom": "value"}
        assert project_config.is_enabled

    def test_project_write_cannot_update_main_config(self) -> None:
        """Test that project:write users cannot update main data forwarder config"""
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )

        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.organization,
            role="member",  # Has project:write but not org:write
            teams=[self.team],
            teamRole="admin",
        )
        self.login_as(user=user)

        payload = {
            "provider": DataForwarderProviderSlug.SEGMENT,
            "config": {"write_key": "new_key"},
            "is_enabled": False,
        }

        self.get_error_response(
            self.organization.slug, data_forwarder.id, status_code=400, **payload
        )

        # Config should remain unchanged
        data_forwarder.refresh_from_db()
        assert data_forwarder.config == {"write_key": "old_key"}
        assert data_forwarder.is_enabled


@region_silo_test
class DataForwardingDetailsDeleteTest(DataForwardingDetailsEndpointTest):
    method = "DELETE"

    def test_without_revamp_feature_flag_access(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": False,
                "organizations:data-forwarding": True,
            }
        ):
            response = self.client.delete(
                reverse(self.endpoint, args=(self.organization.slug, data_forwarder.id))
            )
            assert response.status_code == 403

    def test_without_data_forwarding_feature_flag_access(self) -> None:
        data_forwarder = self.create_data_forwarder(
            provider=DataForwarderProviderSlug.SEGMENT,
            config={"write_key": "old_key"},
            is_enabled=True,
        )
        with self.feature(
            {
                "organizations:data-forwarding-revamp-access": True,
                "organizations:data-forwarding": False,
            }
        ):
            response = self.client.delete(
                reverse(self.endpoint, args=(self.organization.slug, data_forwarder.id))
            )
            assert response.status_code == 204

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
