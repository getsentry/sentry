import datetime
from unittest.mock import MagicMock, patch

from sentry.hybridcloud.models.outbox import RegionOutbox
from sentry.hybridcloud.outbox.category import OutboxScope
from sentry.models.apitoken import ApiToken
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.organization_option import OrganizationOption
from sentry.replays.models import OrganizationMemberReplayAccess, ReplayDeletionJobModel
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils.cursors import Cursor


@region_silo_test
class ProjectReplayDeletionJobsIndexTest(APITestCase):
    endpoint = "sentry-api-0-project-replay-deletion-jobs-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.other_project = self.create_project()  # Different organization

    def test_get_no_jobs(self) -> None:
        """Test GET with no deletion jobs returns empty list"""
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == {"data": []}

    def test_get_multiple_jobs(self) -> None:
        """Test GET returns multiple jobs in correct order (newest first)"""
        # Create multiple jobs using the factory method
        job1 = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query 1",
            environments=["prod"],
            status="pending",
        )
        job2 = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 3, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 4, tzinfo=datetime.UTC),
            query="test query 2",
            environments=["staging"],
            status="in-progress",
        )

        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert len(response.data["data"]) == 2

        # Should be ordered by newest first (job2 then job1)
        assert response.data["data"][0]["id"] == job2.id
        assert response.data["data"][1]["id"] == job1.id

        # Verify data structure
        job_data = response.data["data"][0]
        assert job_data["status"] == "in-progress"
        assert job_data["environments"] == ["staging"]
        assert job_data["query"] == "test query 2"
        assert job_data["countDeleted"] == 0  # Default offset value
        assert "dateCreated" in job_data
        assert "dateUpdated" in job_data
        assert "rangeStart" in job_data
        assert "rangeEnd" in job_data

        job_data = response.data["data"][1]
        assert job_data["status"] == "pending"
        assert job_data["environments"] == ["prod"]
        assert job_data["query"] == "test query 1"
        assert job_data["countDeleted"] == 0  # Default offset value
        assert "dateCreated" in job_data
        assert "dateUpdated" in job_data
        assert "rangeStart" in job_data
        assert "rangeEnd" in job_data

    def test_get_only_accessible_projects(self) -> None:
        """Test GET only returns jobs for projects user has access to"""
        # Create job for accessible project
        accessible_job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="accessible",
            environments=[],
            status="pending",
        )

        # Create job for inaccessible project (different organization)
        ReplayDeletionJobModel.objects.create(
            project_id=self.other_project.id,
            organization_id=self.other_project.organization_id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="inaccessible",
            environments=[],
            status="pending",
        )

        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == accessible_job.id
        assert response.data["data"][0]["query"] == "accessible"
        assert response.data["data"][0]["countDeleted"] == 0  # Default offset value

    def test_get_count_deleted_reflects_offset(self) -> None:
        """Test that countDeleted field correctly reflects the offset value"""
        # Create job with specific offset value
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=["prod"],
            status="in-progress",
            offset=42,  # Set specific offset value
        )

        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["id"] == job.id
        assert response.data["data"][0]["countDeleted"] == 42

    def test_get_pagination(self) -> None:
        """Test GET pagination works correctly"""
        # Create multiple jobs
        for i in range(15):
            ReplayDeletionJobModel.objects.create(
                project_id=self.project.id,
                organization_id=self.organization.id,
                range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
                range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
                query=f"query {i}",
                environments=[],
                status="pending",
            )

        # Test first page
        response = self.get_success_response(self.organization.slug, self.project.slug, per_page=10)
        assert len(response.data["data"]) == 10
        assert response.data["data"][0]["query"] == "query 14"

        # Test second page
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            cursor=Cursor(10, 1),
        )
        assert len(response.data["data"]) == 5
        assert response.data["data"][0]["query"] == "query 4"

    @patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay")
    def test_post_success(self, mock_task: MagicMock) -> None:
        """Test successful POST creates job and schedules task"""
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": None,
            }
        }

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="post", **data, status_code=201
        )

        # Verify response structure
        assert "data" in response.data
        job_data = response.data["data"]
        assert job_data["status"] == "pending"
        assert job_data["environments"] == ["production"]
        assert job_data["query"] == ""
        assert job_data["countDeleted"] == 0  # Default offset value

        # Verify job was created in database
        job = ReplayDeletionJobModel.objects.get(id=job_data["id"])
        assert job.project_id == self.project.id
        assert job.status == "pending"

        # Verify task was scheduled
        mock_task.assert_called_once_with(job.id, offset=0, has_seer_data=False)

        with assume_test_silo_mode(SiloMode.REGION):
            RegionOutbox(
                shard_scope=OutboxScope.AUDIT_LOG_SCOPE, shard_identifier=self.organization.id
            ).drain_shard()

        with assume_test_silo_mode(SiloMode.CONTROL):
            entry = AuditLogEntry.objects.get()
            assert entry is not None
            assert entry.event == 1156

    def test_post_validation_errors(self) -> None:
        """Test POST validation errors"""
        # Missing required fields
        response = self.get_error_response(
            self.organization.slug, self.project.slug, method="post", status_code=400, data={}
        )
        assert "environments" in response.data["data"]
        assert "query" in response.data["data"]

        # Invalid date range (end before start)
        data = {
            "data": {
                "rangeStart": "2023-01-02T00:00:00Z",
                "rangeEnd": "2023-01-01T00:00:00Z",
                "query": "",
                "environments": [],
            }
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, method="post", **data, status_code=400
        )
        assert "rangeStart must be before rangeEnd" in str(response.data["data"])

    def test_permission_denied_without_project_write(self) -> None:
        """Test that users without project:write permissions get 403 Forbidden"""
        # Create a user with only member role (no project:write permissions)
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="member")
        self.login_as(user=user)

        # Create a team but don't add the user to it
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])

        # GET should return 403
        self.get_error_response(self.organization.slug, project.slug, status_code=403)

        # POST should return 403
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": "test query",
            }
        }
        self.get_error_response(
            self.organization.slug, project.slug, method="post", **data, status_code=403
        )

    def test_permission_denied_with_api_token_insufficient_scope(self) -> None:
        """Test that API tokens without project:write scope get 403 Forbidden"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with only project:read scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])

        # GET should return 403
        response = self.client.get(
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            format="json",
        )
        assert response.status_code == 403

        # POST should return 403
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": "test query",
            }
        }
        response = self.client.post(
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
            data=data,
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            format="json",
        )
        assert response.status_code == 403

    def test_permission_granted_with_project_write(self) -> None:
        """Test that users with project:write permissions can access endpoints"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with project:write scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        # GET should succeed
        response = self.client.get(
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            format="json",
        )
        assert response.status_code == 200

        # POST should succeed
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": "test query",
            }
        }
        with patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay"):
            response = self.client.post(
                f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
                data=data,
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                format="json",
            )
        assert response.status_code == 201

    def test_permission_granted_with_project_admin(self) -> None:
        """Test that users with project:admin permissions can access endpoints"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with project:admin scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:admin"])

        # GET should succeed
        response = self.client.get(
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            format="json",
        )
        assert response.status_code == 200

        # POST should succeed
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": "test query",
            }
        }
        with patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay"):
            response = self.client.post(
                f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/",
                data=data,
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                format="json",
            )
        assert response.status_code == 201

    def test_granular_permissions_without_replay_access(self) -> None:
        """Test that users without replay access cannot access endpoints even with project:write"""
        with self.feature("organizations:granular-replay-permissions"):
            # Enable granular permissions org option
            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=True,
            )

            # Create another user with replay access
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access, organization=self.organization, role="admin"
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

            # Login as user without replay access (but has project:write via admin role)
            user_without_access = self.create_user()
            self.create_member(
                user=user_without_access, organization=self.organization, role="admin"
            )
            self.login_as(user=user_without_access)

            # GET should return 403
            self.get_error_response(self.organization.slug, self.project.slug, status_code=403)

            # POST should return 403
            data = {
                "data": {
                    "rangeStart": "2023-01-01T00:00:00Z",
                    "rangeEnd": "2023-01-02T00:00:00Z",
                    "environments": ["production"],
                    "query": "test query",
                }
            }
            self.get_error_response(
                self.organization.slug, self.project.slug, method="post", **data, status_code=403
            )

    def test_granular_permissions_with_replay_access(self) -> None:
        """Test that users with replay access can access endpoints with project:write"""
        with self.feature("organizations:granular-replay-permissions"):
            # Enable granular permissions org option
            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=True,
            )

            # Create user with replay access (admin role gives project:write)
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access, organization=self.organization, role="admin"
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)
            self.login_as(user=user_with_access)

            # GET should succeed
            response = self.get_success_response(self.organization.slug, self.project.slug)
            assert response.data == {"data": []}

            # POST should succeed
            data = {
                "data": {
                    "rangeStart": "2023-01-01T00:00:00Z",
                    "rangeEnd": "2023-01-02T00:00:00Z",
                    "environments": ["production"],
                    "query": "test query",
                }
            }
            with patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay"):
                response = self.get_success_response(
                    self.organization.slug,
                    self.project.slug,
                    method="post",
                    **data,
                    status_code=201,
                )
            assert "data" in response.data

    def test_granular_permissions_feature_disabled_allows_all(self) -> None:
        """Test that when feature flag is disabled, all users with project:write can access"""
        # Enable org option but disable feature flag
        OrganizationOption.objects.set_value(
            organization=self.organization,
            key="sentry:granular-replay-permissions",
            value=True,
        )

        # Create user with replay access
        user_with_access = self.create_user()
        member_with_access = self.create_member(
            user=user_with_access, organization=self.organization, role="admin"
        )
        OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

        # Login as user without replay access (admin role gives project:write)
        user_without_access = self.create_user()
        self.create_member(user=user_without_access, organization=self.organization, role="admin")
        self.login_as(user=user_without_access)

        # GET should succeed (feature flag is OFF)
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == {"data": []}

    def test_granular_permissions_org_option_disabled_allows_all(self) -> None:
        """Test that when org option is disabled, all users with project:write can access"""
        with self.feature("organizations:granular-replay-permissions"):
            # Create user with replay access
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access, organization=self.organization, role="admin"
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

            # Login as user without replay access (org option is NOT enabled, admin role gives project:write)
            user_without_access = self.create_user()
            self.create_member(
                user=user_without_access, organization=self.organization, role="admin"
            )
            self.login_as(user=user_without_access)

            # GET should succeed (org option is OFF)
            response = self.get_success_response(self.organization.slug, self.project.slug)
            assert response.data == {"data": []}

    @patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay")
    def test_post_has_seer_data(self, mock_task: MagicMock) -> None:
        """Test POST with summaries enabled schedules task with has_seer_data=True."""
        data = {
            "data": {
                "rangeStart": "2023-01-01T00:00:00Z",
                "rangeEnd": "2023-01-02T00:00:00Z",
                "environments": ["production"],
                "query": None,
            }
        }

        with self.feature({"organizations:replay-ai-summaries": True}):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, method="post", **data, status_code=201
            )

        job_data = response.data["data"]
        job = ReplayDeletionJobModel.objects.get(id=job_data["id"])
        assert job.project_id == self.project.id
        assert job.status == "pending"

        mock_task.assert_called_once_with(job.id, offset=0, has_seer_data=True)


@region_silo_test
class ProjectReplayDeletionJobDetailTest(APITestCase):
    endpoint = "sentry-api-0-project-replay-deletion-job-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.other_project = self.create_project()  # Different organization

    def test_get_success(self) -> None:
        """Test successful GET for single job"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=["prod", "staging"],
            status="in-progress",
        )

        with self.feature("organizations:session-replay"):
            response = self.get_success_response(self.organization.slug, self.project.slug, job.id)

            assert "data" in response.data
            job_data = response.data["data"]
            assert job_data["id"] == job.id
            assert job_data["status"] == "in-progress"
            assert job_data["environments"] == ["prod", "staging"]
            assert job_data["query"] == "test query"
            assert job_data["countDeleted"] == 0  # Default offset value
            assert "dateCreated" in job_data
            assert "dateUpdated" in job_data
            assert "rangeStart" in job_data
            assert "rangeEnd" in job_data

    def test_get_count_deleted_reflects_offset(self) -> None:
        """Test that countDeleted field correctly reflects the offset value"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=["prod"],
            status="completed",
            offset=123,  # Set specific offset value
        )

        with self.feature("organizations:session-replay"):
            response = self.get_success_response(self.organization.slug, self.project.slug, job.id)

            assert "data" in response.data
            job_data = response.data["data"]
            assert job_data["id"] == job.id
            assert job_data["countDeleted"] == 123

    def test_get_nonexistent_job(self) -> None:
        """Test GET for non-existent job returns 404"""
        self.get_error_response(self.organization.slug, self.project.slug, 99999, status_code=404)

    def test_get_job_from_different_organization(self) -> None:
        """Test GET for job in different organization returns 404"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.other_project.id,
            organization_id=self.other_project.organization_id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        self.get_error_response(self.organization.slug, self.project.slug, job.id, status_code=404)

    def test_get_job_from_different_project(self) -> None:
        """Test GET for job in different project returns 404"""
        other_project_same_org = self.create_project(organization=self.organization)
        job = ReplayDeletionJobModel.objects.create(
            project_id=other_project_same_org.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        # Job exists for same org but different project - should return 404
        self.get_error_response(self.organization.slug, self.project.slug, job.id, status_code=404)

    def test_permission_denied_without_project_write(self) -> None:
        """Test that users without project:write permissions get 403 Forbidden"""
        # Create a user with only member role (no project:write permissions)
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="member")
        self.login_as(user=user)

        # Create a team but don't add the user to it
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])

        job = ReplayDeletionJobModel.objects.create(
            project_id=project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        # GET should return 403
        self.get_error_response(self.organization.slug, project.slug, job.id, status_code=403)

    def test_permission_denied_with_api_token_insufficient_scope(self) -> None:
        """Test that API tokens without project:write scope get 403 Forbidden"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with only project:read scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])

        # GET should return 403
        response = self.client.get(
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/{job.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            format="json",
        )
        assert response.status_code == 403

    def test_permission_granted_with_project_write(self) -> None:
        """Test that users with project:write permissions can access endpoint"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with project:write scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        # GET should succeed
        with self.feature("organizations:session-replay"):
            response = self.client.get(
                f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/{job.id}/",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                format="json",
            )
            assert response.status_code == 200
            assert response.data["data"]["id"] == job.id

    def test_permission_granted_with_project_admin(self) -> None:
        """Test that users with project:admin permissions can access endpoint"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Create API token with project:admin scope
            token = ApiToken.objects.create(user=self.user, scope_list=["project:admin"])

        # GET should succeed
        with self.feature("organizations:session-replay"):
            response = self.client.get(
                f"/api/0/projects/{self.organization.slug}/{self.project.slug}/replays/jobs/delete/{job.id}/",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
                format="json",
            )
            assert response.status_code == 200
            assert response.data["data"]["id"] == job.id

    def test_granular_permissions_without_replay_access(self) -> None:
        """Test that users without replay access cannot access endpoint even with project:write"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            # Enable granular permissions org option
            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=True,
            )

            # Create another user with replay access
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

            # Login as user without replay access (but has project:write via admin role)
            user_without_access = self.create_user()
            self.create_member(
                user=user_without_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            self.login_as(user=user_without_access)

            # GET should return 403
            self.get_error_response(
                self.organization.slug, self.project.slug, job.id, status_code=403
            )

    def test_granular_permissions_with_replay_access(self) -> None:
        """Test that users with replay access can access endpoint with project:write"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            # Enable granular permissions org option
            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=True,
            )

            # Create user with replay access (admin role gives project:write)
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)
            self.login_as(user=user_with_access)

            # GET should succeed
            response = self.get_success_response(self.organization.slug, self.project.slug, job.id)
            assert response.data["data"]["id"] == job.id

    def test_granular_permissions_feature_disabled_allows_all(self) -> None:
        """Test that when feature flag is disabled, all users with project:write can access"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        # Enable session-replay and org option but disable granular-replay-permissions feature flag
        with self.feature("organizations:session-replay"):
            OrganizationOption.objects.set_value(
                organization=self.organization,
                key="sentry:granular-replay-permissions",
                value=True,
            )

            # Create user with replay access
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

            # Login as user without replay access (admin role gives project:write)
            user_without_access = self.create_user()
            self.create_member(
                user=user_without_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            self.login_as(user=user_without_access)

            # GET should succeed (feature flag is OFF)
            response = self.get_success_response(self.organization.slug, self.project.slug, job.id)
            assert response.data["data"]["id"] == job.id

    def test_granular_permissions_org_option_disabled_allows_all(self) -> None:
        """Test that when org option is disabled, all users with project:write can access"""
        job = ReplayDeletionJobModel.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            range_start=datetime.datetime(2023, 1, 1, tzinfo=datetime.UTC),
            range_end=datetime.datetime(2023, 1, 2, tzinfo=datetime.UTC),
            query="test query",
            environments=[],
            status="pending",
        )

        with self.feature(
            ["organizations:session-replay", "organizations:granular-replay-permissions"]
        ):
            # Create user with replay access
            user_with_access = self.create_user()
            member_with_access = self.create_member(
                user=user_with_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            OrganizationMemberReplayAccess.objects.create(organizationmember=member_with_access)

            # Login as user without replay access (org option is NOT enabled, admin role gives project:write)
            user_without_access = self.create_user()
            self.create_member(
                user=user_without_access,
                organization=self.organization,
                role="admin",
                teams=[self.team],
            )
            self.login_as(user=user_without_access)

            # GET should succeed (org option is OFF)
            response = self.get_success_response(self.organization.slug, self.project.slug, job.id)
            assert response.data["data"]["id"] == job.id
