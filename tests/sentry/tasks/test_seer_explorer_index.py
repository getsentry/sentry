from datetime import UTC, datetime
from unittest import mock

import orjson
import pytest
import responses
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.models.promptsactivity import PromptsActivity
from sentry.tasks.seer_explorer_index import (
    dispatch_explorer_index_projects,
    get_seer_explorer_enabled_projects,
    run_explorer_index_for_projects,
    schedule_explorer_index,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestGetSeerExplorerEnabledProjects(TestCase):
    @freeze_time("2024-01-15 12:00:00")
    def test_returns_projects_with_feature_flag(self):
        org1 = self.create_organization()
        org2 = self.create_organization()
        org3 = self.create_organization()
        org4 = self.create_organization()

        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org1)
        project3 = self.create_project(organization=org2)
        project4 = self.create_project(organization=org3)
        project5 = self.create_project(organization=org4)

        project1.flags.has_transactions = True
        project1.save()
        project2.flags.has_transactions = True
        project2.save()
        project3.flags.has_transactions = True
        project3.save()

        PromptsActivity.objects.create(
            organization_id=org1.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )
        PromptsActivity.objects.create(
            organization_id=org2.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        with self.feature(
            {
                "organizations:gen-ai-features": [org1.slug, org2.slug],
                "organizations:seer-explorer-index": [org1.slug, org2.slug],
            }
        ):
            result = list(get_seer_explorer_enabled_projects())

        project_ids = [p[0] for p in result]
        expected_ids = []
        for p in [project1, project2, project3]:
            if p.id % 23 == 12:
                expected_ids.append(p.id)

        assert all(pid in project_ids for pid in expected_ids)
        assert project4.id not in project_ids
        assert project5.id not in project_ids

    @freeze_time("2024-01-15 12:00:00")
    def test_excludes_inactive_projects(self):
        org = self.create_organization()
        active_project = self.create_project(organization=org)
        inactive_project = self.create_project(organization=org)

        active_project.flags.has_transactions = True
        active_project.save()
        inactive_project.flags.has_transactions = True
        inactive_project.save()

        inactive_project.update(status=ObjectStatus.PENDING_DELETION)

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        with self.feature(
            {
                "organizations:gen-ai-features": [org.slug],
                "organizations:seer-explorer-index": [org.slug],
            }
        ):
            result = list(get_seer_explorer_enabled_projects())

        project_ids = [p[0] for p in result]
        if active_project.id % 23 == 12:
            assert active_project.id in project_ids
        assert inactive_project.id not in project_ids

    def test_returns_empty_without_feature_flag(self):
        org = self.create_organization()
        self.create_project(organization=org)

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        result = list(get_seer_explorer_enabled_projects())
        assert len(result) == 0

    def test_excludes_projects_with_hide_ai_features(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        org.update_option("sentry:hide_ai_features", True)

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        with self.feature(
            {
                "organizations:gen-ai-features": [org.slug],
                "organizations:seer-explorer-index": [org.slug],
            }
        ):
            result = list(get_seer_explorer_enabled_projects())

        assert len(result) == 0
        assert project.id not in [p[0] for p in result]

    @freeze_time("2024-01-15 12:00:00")
    def test_excludes_projects_without_seer_acknowledgement(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        project.flags.has_transactions = True
        project.save()

        with self.feature(
            {
                "organizations:gen-ai-features": [org.slug],
                "organizations:seer-explorer-index": [org.slug],
            }
        ):
            result = list(get_seer_explorer_enabled_projects())

        assert len(result) == 0
        assert project.id not in [p[0] for p in result]

    @freeze_time("2024-01-15 12:00:00")
    def test_excludes_projects_without_transactions(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        with self.feature(
            {
                "organizations:gen-ai-features": [org.slug],
                "organizations:seer-explorer-index": [org.slug],
            }
        ):
            result = list(get_seer_explorer_enabled_projects())

        assert len(result) == 0
        assert project.id not in [p[0] for p in result]

    def test_includes_only_projects_matching_hour_shard(self):
        org = self.create_organization()

        project1 = self.create_project(organization=org)
        project2 = self.create_project(organization=org)

        project1.flags.has_transactions = True
        project1.save()
        project2.flags.has_transactions = True
        project2.save()

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        target_hour = project1.id % 23

        with self.feature(
            {
                "organizations:gen-ai-features": [org.slug],
                "organizations:seer-explorer-index": [org.slug],
            }
        ):
            with freeze_time(f"2024-01-15 {target_hour:02d}:00:00"):
                result = list(get_seer_explorer_enabled_projects())

        project_ids = [p[0] for p in result]
        assert project1.id in project_ids

        if project2.id % 23 == target_hour:
            assert project2.id in project_ids
        else:
            assert project2.id not in project_ids


@django_db_all
class TestScheduleExplorerIndex(TestCase):
    def test_skips_when_option_disabled(self):
        with self.options({"seer.explorer_index.enable": False}):
            with mock.patch(
                "sentry.tasks.seer_explorer_index.get_seer_explorer_enabled_projects"
            ) as mock_get_projects:
                schedule_explorer_index()
                mock_get_projects.assert_not_called()

    @freeze_time("2024-01-15 12:00:00")
    def test_schedules_projects_with_option_enabled(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        project.flags.has_transactions = True
        project.save()

        PromptsActivity.objects.create(
            organization_id=org.id,
            project_id=0,
            user_id=self.user.id,
            feature="seer_autofix_setup_acknowledged",
        )

        with self.options({"seer.explorer_index.enable": True}):
            with self.feature(
                {
                    "organizations:gen-ai-features": [org.slug],
                    "organizations:seer-explorer-index": [org.slug],
                }
            ):
                with mock.patch(
                    "sentry.tasks.seer_explorer_index.dispatch_explorer_index_projects"
                ) as mock_dispatch:
                    mock_dispatch.return_value = iter([])
                    schedule_explorer_index()
                    mock_dispatch.assert_called_once()


@django_db_all
class TestDispatchExplorerIndexProjects(TestCase):
    @freeze_time("2024-01-15 12:00:00")
    def test_batches_projects_with_delays(self):
        timestamp = datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
        projects = [(i, 1) for i in range(150)]

        with mock.patch(
            "sentry.tasks.seer_explorer_index.run_explorer_index_for_projects.apply_async"
        ) as mock_task:
            result = list(dispatch_explorer_index_projects(iter(projects), timestamp))

        assert mock_task.call_count == 2
        assert len(mock_task.call_args_list[0][1]["args"][0]) == 100
        assert len(mock_task.call_args_list[1][1]["args"][0]) == 50

        for call in mock_task.call_args_list:
            assert "countdown" in call[1]
            assert call[1]["countdown"] >= 0

        assert len(result) == 150


@django_db_all
class TestRunExplorerIndexForProjects(TestCase):
    @responses.activate
    def test_calls_seer_endpoint_successfully(self):
        projects = [(1, 100), (2, 100), (3, 200)]
        start = "2024-01-15T12:00:00+00:00"

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/explorer/index",
            json={"scheduled_count": 3, "projects": []},
            status=200,
        )

        with self.options({"seer.explorer_index.enable": True}):
            run_explorer_index_for_projects(projects, start)

        request_body = orjson.loads(responses.calls[0].request.body)
        assert request_body["projects"] == [
            {"org_id": 100, "project_id": 1},
            {"org_id": 100, "project_id": 2},
            {"org_id": 200, "project_id": 3},
        ]

    @responses.activate
    def test_handles_request_error(self):
        projects = [(1, 100)]
        start = "2024-01-15T12:00:00+00:00"

        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/explorer/index",
            json={"error": "Internal server error"},
            status=500,
        )

        with self.options({"seer.explorer_index.enable": True}):
            with pytest.raises(Exception):
                run_explorer_index_for_projects(projects, start)

    def test_skips_when_option_disabled(self):
        with self.options({"seer.explorer_index.enable": False}):
            with mock.patch("sentry.tasks.seer_explorer_index.requests.post") as mock_post:
                run_explorer_index_for_projects([(1, 100)], "2024-01-15T12:00:00+00:00")
                mock_post.assert_not_called()
