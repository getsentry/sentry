from unittest import mock

import orjson
import pytest

from sentry.seer.explorer.context_engine_utils import ProjectEventCounts
from sentry.tasks.context_engine_index import (
    index_org_project_knowledge,
    schedule_context_engine_indexing_tasks,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestIndexOrgProjectKnowledge(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org, platform="python")
        self.project.flags.has_transactions = True
        self.project.flags.has_profiles = True
        self.project.save()

    def test_returns_early_when_no_projects_found(self):
        org_without_projects = self.create_organization()
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.context_engine_index.get_event_counts_for_org_projects"
            ) as mock_counts:
                index_org_project_knowledge(org_without_projects.id)
                mock_counts.assert_not_called()

    def test_returns_early_when_no_high_volume_projects(self):
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.context_engine_index.get_event_counts_for_org_projects",
                return_value={},
            ):
                with mock.patch(
                    "sentry.tasks.context_engine_index.make_signed_seer_api_request"
                ) as mock_request:
                    index_org_project_knowledge(self.org.id)
                    mock_request.assert_not_called()

    @mock.patch("sentry.tasks.context_engine_index.make_signed_seer_api_request")
    def test_calls_seer_endpoint_with_correct_payload(self, mock_request):
        mock_request.return_value.status = 200

        event_counts = {
            self.project.id: ProjectEventCounts(error_count=5000, transaction_count=2000)
        }

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.context_engine_index.get_event_counts_for_org_projects",
                return_value=event_counts,
            ):
                with mock.patch(
                    "sentry.tasks.context_engine_index.get_top_transactions_for_org_projects",
                    return_value={self.project.id: ["GET /api/0/projects/"]},
                ):
                    with mock.patch(
                        "sentry.tasks.context_engine_index.get_top_span_ops_for_org_projects",
                        return_value={self.project.id: [("db", "SELECT * FROM table")]},
                    ):
                        with mock.patch(
                            "sentry.tasks.context_engine_index.get_sdk_names_for_org_projects",
                            return_value={self.project.id: "sentry.python"},
                        ):
                            index_org_project_knowledge(self.org.id)

        mock_request.assert_called_once()
        body = orjson.loads(mock_request.call_args[0][2])
        assert body["org_id"] == self.org.id
        assert len(body["projects"]) == 1

        project_payload = body["projects"][0]
        assert project_payload["project_id"] == self.project.id
        assert project_payload["slug"] == self.project.slug
        assert project_payload["sdk_name"] == "sentry.python"
        assert project_payload["error_count"] == 5000
        assert project_payload["transaction_count"] == 2000
        assert "transactions" in project_payload["instrumentation"]
        assert "profiles" in project_payload["instrumentation"]
        assert project_payload["top_transactions"] == ["GET /api/0/projects/"]
        assert project_payload["top_span_operations"] == [["db", "SELECT * FROM table"]]

    @mock.patch("sentry.tasks.context_engine_index.make_signed_seer_api_request")
    def test_raises_on_seer_error(self, mock_request):
        mock_request.return_value.status = 500

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.context_engine_index.get_event_counts_for_org_projects",
                return_value={
                    self.project.id: ProjectEventCounts(error_count=5000, transaction_count=2000)
                },
            ):
                with mock.patch(
                    "sentry.tasks.context_engine_index.get_top_transactions_for_org_projects",
                    return_value={},
                ):
                    with mock.patch(
                        "sentry.tasks.context_engine_index.get_top_span_ops_for_org_projects",
                        return_value={},
                    ):
                        with mock.patch(
                            "sentry.tasks.context_engine_index.get_sdk_names_for_org_projects",
                            return_value={},
                        ):
                            with pytest.raises(Exception):
                                index_org_project_knowledge(self.org.id)


@django_db_all
class TestScheduleContextEngineIndexingTasks(TestCase):
    @mock.patch("sentry.tasks.context_engine_index.build_service_map.apply_async")
    @mock.patch("sentry.tasks.context_engine_index.index_org_project_knowledge.apply_async")
    def test_dispatches_for_allowed_orgs(self, mock_index, mock_build):
        org1 = self.create_organization()
        org2 = self.create_organization()

        with override_options(
            {
                "explorer.context_engine_indexing.enable": True,
                "explorer.service_map.allowed_organizations": [org1.id, org2.id],
            }
        ):
            schedule_context_engine_indexing_tasks()

        assert mock_index.call_count == 2
        assert mock_build.call_count == 2
        dispatched_index_ids = [c[1]["args"][0] for c in mock_index.call_args_list]
        assert dispatched_index_ids == [org1.id, org2.id]

    @mock.patch("sentry.tasks.context_engine_index.build_service_map.apply_async")
    @mock.patch("sentry.tasks.context_engine_index.index_org_project_knowledge.apply_async")
    def test_noop_when_no_allowed_orgs(self, mock_index, mock_build):
        with override_options(
            {
                "explorer.context_engine_indexing.enable": True,
                "explorer.service_map.allowed_organizations": [],
            }
        ):
            schedule_context_engine_indexing_tasks()

        mock_index.assert_not_called()
        mock_build.assert_not_called()
