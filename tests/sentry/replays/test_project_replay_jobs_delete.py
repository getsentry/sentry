import datetime
from unittest.mock import patch

from sentry.replays.models import ReplayDeletionJobModel
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor


@region_silo_test
class ProjectReplayDeletionJobsIndexTest(APITestCase):
    endpoint = "sentry-api-0-project-replay-deletion-jobs-index"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.other_project = self.create_project()  # Different organization

    def test_get_no_jobs(self):
        """Test GET with no deletion jobs returns empty list"""
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == {"data": []}

    def test_get_multiple_jobs(self):
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
        assert "dateCreated" in job_data
        assert "dateUpdated" in job_data
        assert "rangeStart" in job_data
        assert "rangeEnd" in job_data

        job_data = response.data["data"][1]
        assert job_data["status"] == "pending"
        assert job_data["environments"] == ["prod"]
        assert job_data["query"] == "test query 1"
        assert "dateCreated" in job_data
        assert "dateUpdated" in job_data
        assert "rangeStart" in job_data
        assert "rangeEnd" in job_data

    def test_get_only_accessible_projects(self):
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

    def test_get_pagination(self):
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
        assert response.data["data"][0]["id"] == 15

        # Test second page
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            cursor=Cursor(10, 1),
        )
        assert len(response.data["data"]) == 5
        assert response.data["data"][0]["id"] == 5

    @patch("sentry.replays.tasks.run_bulk_replay_delete_job.delay")
    def test_post_success(self, mock_task):
        """Test successful POST creates job and schedules task"""
        data = {
            "rangeStart": "2023-01-01T00:00:00Z",
            "rangeEnd": "2023-01-02T00:00:00Z",
            "environments": ["production"],
            "query": "test query",
        }

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="post", **data, status_code=201
        )

        # Verify response structure
        assert "data" in response.data
        job_data = response.data["data"]
        assert job_data["status"] == "pending"
        assert job_data["environments"] == ["production"]
        assert job_data["query"] == "test query"

        # Verify job was created in database
        job = ReplayDeletionJobModel.objects.get(id=job_data["id"])
        assert job.project_id == self.project.id
        assert job.status == "pending"

        # Verify task was scheduled
        mock_task.assert_called_once_with(job.id, offset=0)

    def test_post_validation_errors(self):
        """Test POST validation errors"""
        # Missing required fields
        response = self.get_error_response(
            self.organization.slug, self.project.slug, method="post", status_code=400
        )
        assert "environments" in response.data
        assert "query" in response.data

        # Invalid date range (end before start)
        data = {
            "rangeStart": "2023-01-02T00:00:00Z",
            "rangeEnd": "2023-01-01T00:00:00Z",
            "query": "",
            "environments": [],
        }
        response = self.get_error_response(
            self.organization.slug, self.project.slug, method="post", **data, status_code=400
        )
        assert "rangeStart must be before rangeEnd" in str(response.data)


@region_silo_test
class ProjectReplayDeletionJobDetailTest(APITestCase):
    endpoint = "sentry-api-0-project-replay-deletion-job-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.other_project = self.create_project()  # Different organization

    def test_get_success(self):
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

        response = self.get_success_response(self.organization.slug, self.project.slug, job.id)

        assert "data" in response.data
        job_data = response.data["data"]
        assert job_data["id"] == job.id
        assert job_data["status"] == "in-progress"
        assert job_data["environments"] == ["prod", "staging"]
        assert job_data["query"] == "test query"
        assert "dateCreated" in job_data
        assert "dateUpdated" in job_data
        assert "rangeStart" in job_data
        assert "rangeEnd" in job_data

    def test_get_nonexistent_job(self):
        """Test GET for non-existent job returns 404"""
        self.get_error_response(self.organization.slug, self.project.slug, 99999, status_code=404)

    def test_get_job_from_different_organization(self):
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

    def test_get_job_from_different_project(self):
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
