from unittest import mock

import pytest

from sentry.seer.explorer.context_engine_utils import ProjectEventCounts
from sentry.seer.models import SeerProjectPreference, SeerRepoDefinition
from sentry.tasks.seer.context_engine_index import (
    get_allowed_org_ids_context_engine_indexing,
    index_org_project_knowledge,
    index_repos,
    schedule_context_engine_indexing_tasks,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestIndexOrgProjectKnowledge(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org, platform="python")
        self.project.flags.has_transactions = True
        self.project.flags.has_profiles = True
        self.project.save()

    def test_returns_early_when_no_projects_found(self) -> None:
        org_without_projects = self.create_organization()
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.get_event_counts_for_org_projects"
            ) as mock_counts:
                index_org_project_knowledge(org_without_projects.id)
                mock_counts.assert_not_called()

    def test_returns_early_when_no_high_volume_projects(self) -> None:
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.get_event_counts_for_org_projects",
                return_value={},
            ):
                with mock.patch(
                    "sentry.tasks.seer.context_engine_index.make_org_project_knowledge_index_request"
                ) as mock_request:
                    index_org_project_knowledge(self.org.id)
                    mock_request.assert_not_called()

    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_project_knowledge_index_request")
    def test_calls_seer_endpoint_with_correct_payload(self, mock_request):
        mock_request.return_value.status = 200

        event_counts = {
            self.project.id: ProjectEventCounts(error_count=5000, transaction_count=2000)
        }

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.get_event_counts_for_org_projects",
                return_value=event_counts,
            ):
                with mock.patch(
                    "sentry.tasks.seer.context_engine_index.get_top_transactions_for_org_projects",
                    return_value={self.project.id: ["GET /api/0/projects/"]},
                ):
                    with mock.patch(
                        "sentry.tasks.seer.context_engine_index.get_top_span_ops_for_org_projects",
                        return_value={self.project.id: [("db", "SELECT * FROM table")]},
                    ):
                        with mock.patch(
                            "sentry.tasks.seer.context_engine_index.get_sdk_names_for_org_projects",
                            return_value={self.project.id: "sentry.python"},
                        ):
                            index_org_project_knowledge(self.org.id)

        mock_request.assert_called_once()
        body = mock_request.call_args[0][0]
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
        assert project_payload["top_span_operations"] == [("db", "SELECT * FROM table")]

    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_project_knowledge_index_request")
    def test_raises_on_seer_error(self, mock_request):
        mock_request.return_value.status = 500

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.get_event_counts_for_org_projects",
                return_value={
                    self.project.id: ProjectEventCounts(error_count=5000, transaction_count=2000)
                },
            ):
                with mock.patch(
                    "sentry.tasks.seer.context_engine_index.get_top_transactions_for_org_projects",
                    return_value={},
                ):
                    with mock.patch(
                        "sentry.tasks.seer.context_engine_index.get_top_span_ops_for_org_projects",
                        return_value={},
                    ):
                        with mock.patch(
                            "sentry.tasks.seer.context_engine_index.get_sdk_names_for_org_projects",
                            return_value={},
                        ):
                            with pytest.raises(Exception):
                                index_org_project_knowledge(self.org.id)


@django_db_all
class TestGetAllowedOrgIdsContextEngineIndexing(TestCase):
    def _create_org_with_github(self):
        org = self.create_organization()
        self.create_integration(
            organization=org,
            provider="github",
            external_id=f"github:{org.id}",
        )
        return org

    def test_returns_only_orgs_assigned_to_current_slot(self) -> None:
        from sentry.utils.hashlib import md5_text

        orgs = [self._create_org_with_github() for _ in range(50)]
        org_ids = [org.id for org in orgs]

        TOTAL_SLOTS = 24
        target_slot = int(md5_text(str(org_ids[0])).hexdigest(), 16) % TOTAL_SLOTS
        frozen_time = f"2024-01-14 {target_slot:02d}:00:00"

        def feature_enabled_for_test_orgs(_flag_name: str, org, *args, **kwargs) -> bool:
            return org.id in org_ids

        with freeze_time(frozen_time):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.features.has",
                side_effect=feature_enabled_for_test_orgs,
            ):
                eligible = get_allowed_org_ids_context_engine_indexing()

        assert len(eligible) > 0
        assert org_ids[0] in eligible
        assert all(org_id in org_ids for org_id in eligible)
        for org_id in eligible:
            assert int(md5_text(str(org_id)).hexdigest(), 16) % TOTAL_SLOTS == target_slot

    def test_excludes_orgs_without_feature_flag(self) -> None:
        from sentry.utils.hashlib import md5_text

        org_with_flag = self._create_org_with_github()
        org_without_flag = self._create_org_with_github()

        TOTAL_SLOTS = 24
        target_slot = int(md5_text(str(org_without_flag.id)).hexdigest(), 16) % TOTAL_SLOTS
        frozen_time = f"2024-01-14 {target_slot:02d}:00:00"

        with freeze_time(frozen_time):
            with self.feature(
                {
                    "organizations:seer-explorer": [org_with_flag.slug],
                    "organizations:seer-explorer-index": [org_with_flag.slug],
                }
            ):
                eligible = get_allowed_org_ids_context_engine_indexing()

        assert org_without_flag.id not in eligible

    def test_returns_empty_when_no_orgs_have_feature_flag(self) -> None:
        with self.feature(
            {
                "organizations:seer-explorer": False,
                "organizations:seer-explorer-index": False,
            }
        ):
            eligible = get_allowed_org_ids_context_engine_indexing()

        assert eligible == []

    def test_excludes_orgs_without_github_integration(self) -> None:
        from sentry.utils.hashlib import md5_text

        org_with_github = self._create_org_with_github()
        org_without_github = self.create_organization()

        TOTAL_SLOTS = 24
        target_slot = int(md5_text(str(org_with_github.id)).hexdigest(), 16) % TOTAL_SLOTS
        frozen_time = f"2024-01-14 {target_slot:02d}:00:00"

        def feature_enabled_for_all(_flag_name: str, org, *args, **kwargs) -> bool:
            return True

        with freeze_time(frozen_time):
            with mock.patch(
                "sentry.tasks.seer.context_engine_index.features.has",
                side_effect=feature_enabled_for_all,
            ):
                eligible = get_allowed_org_ids_context_engine_indexing()

        assert org_without_github.id not in eligible


@django_db_all
class TestIndexRepos(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.integration, self.org_integration = self.create_provider_integration_for(
            organization=self.org,
            user=None,
            provider="github",
            external_id=f"github:{self.org.id}",
        )
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        self.repo1 = self.create_repo(
            project=self.project1,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
            integration_id=self.integration.id,
        )
        self.repo1.languages = ["python", "javascript"]
        self.repo1.save()

        self.repo2 = self.create_repo(
            project=self.project2,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="456",
            integration_id=self.integration.id,
        )
        self.repo2.languages = ["rust"]
        self.repo2.save()

        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            organization_integration=self.org_integration,
        )
        self.create_code_mapping(
            project=self.project2,
            repo=self.repo2,
            organization_integration=self.org_integration,
        )

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_returns_early_when_option_disabled(
        self, mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        with override_options({"explorer.context_engine_indexing.enable": False}):
            index_repos(self.org.id)
        mock_make_org_repo_knowledge_index_request.assert_not_called()

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_returns_early_when_feature_flag_disabled(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        with override_options({"explorer.context_engine_indexing.enable": True}):
            index_repos(self.org.id)
        mock_mock_make_org_repo_knowledge_index_request.assert_not_called()

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_returns_early_when_no_projects(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        org_without_projects = self.create_organization()
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature({"organizations:context-engine-experiments": True}):
                index_repos(org_without_projects.id)
        mock_mock_make_org_repo_knowledge_index_request.assert_not_called()

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_calls_seer_with_correct_org_and_repos(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        mock_bulk_get_project_preferences.return_value = {
            str(self.project1.id): {
                "repositories": [
                    {
                        "name": "sentry",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "123",
                        "integration_id": str(self.integration.id),
                    }
                ],
            },
            str(self.project2.id): {
                "repositories": [
                    {
                        "name": "relay",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "456",
                        "integration_id": str(self.integration.id),
                    }
                ],
            },
        }
        mock_mock_make_org_repo_knowledge_index_request.return_value.status = 200
        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature({"organizations:context-engine-experiments": True}):
                index_repos(self.org.id)

        mock_mock_make_org_repo_knowledge_index_request.assert_called_once()
        body = mock_mock_make_org_repo_knowledge_index_request.call_args[0][0]
        assert body["org_id"] == self.org.id
        repos = body["repos"]
        assert len(repos) == 2

        repos_by_name = {r["name"]: r for r in repos}
        sentry_repo = repos_by_name["sentry"]
        assert sentry_repo["provider"] == "integrations:github"
        assert sentry_repo["owner"] == "getsentry"
        assert sentry_repo["external_id"] == "123"
        assert sentry_repo["languages"] == ["python", "javascript"]
        assert sentry_repo["project_ids"] == [self.project1.id]
        assert sentry_repo["integration_id"] == str(self.integration.id)

        relay_repo = repos_by_name["relay"]
        assert relay_repo["provider"] == "integrations:github"
        assert relay_repo["owner"] == "getsentry"
        assert relay_repo["external_id"] == "456"
        assert relay_repo["languages"] == ["rust"]
        assert relay_repo["project_ids"] == [self.project2.id]
        assert relay_repo["integration_id"] == str(self.integration.id)

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_deduplicates_repos_across_projects(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        mock_bulk_get_project_preferences.return_value = {
            str(self.project1.id): {
                "repositories": [
                    {
                        "name": "sentry",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "123",
                        "integration_id": str(self.integration.id),
                    }
                ],
            },
            str(self.project2.id): {
                "repositories": [
                    {
                        "name": "sentry",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "123",
                        "integration_id": str(self.integration.id),
                    }
                ],
            },
        }
        mock_mock_make_org_repo_knowledge_index_request.return_value.status = 200
        # Map project2 to the same repo as project1
        self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            organization_integration=self.org_integration,
            stack_root="src/",
            source_root="src/",
        )

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature({"organizations:context-engine-experiments": True}):
                index_repos(self.org.id)

        mock_mock_make_org_repo_knowledge_index_request.assert_called_once()
        body = mock_mock_make_org_repo_knowledge_index_request.call_args[0][0]
        repos = body["repos"]
        repos_by_name = {r["name"]: r for r in repos}

        sentry_repo = repos_by_name["sentry"]
        assert sorted(sentry_repo["project_ids"]) == sorted([self.project1.id, self.project2.id])

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_uses_seer_project_preferences_if_available(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        mock_mock_make_org_repo_knowledge_index_request.return_value.status = 200
        # Map project2 to the same repo as project1
        self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            organization_integration=self.org_integration,
            stack_root="src/",
            source_root="src/",
        )

        mock_bulk_get_project_preferences.return_value = {
            str(self.project1.id): {
                "repositories": [
                    {
                        "name": "sentry-seer",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "999",
                        "integration_id": "000",
                    }
                ],
            },
            str(self.project2.id): {
                "repositories": None,
            },
        }

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature({"organizations:context-engine-experiments": True}):
                index_repos(self.org.id)

        mock_mock_make_org_repo_knowledge_index_request.assert_called_once()
        body = mock_mock_make_org_repo_knowledge_index_request.call_args[0][0]
        repos = body["repos"]
        repos_by_name = {r["name"]: r for r in repos}

        assert len(repos) == 1
        sentry_repo = repos_by_name["sentry-seer"]
        assert sorted(sentry_repo["project_ids"]) == sorted([self.project1.id])

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_skips_projects_without_seer_preferences(
        self, mock_mock_make_org_repo_knowledge_index_request, mock_bulk_get_project_preferences
    ) -> None:
        mock_mock_make_org_repo_knowledge_index_request.return_value.status = 200

        # Only project1 has preferences; project2 is absent from the map
        mock_bulk_get_project_preferences.return_value = {
            str(self.project1.id): {
                "repositories": [
                    {
                        "name": "sentry",
                        "owner": "getsentry",
                        "provider": "integrations:github",
                        "external_id": "123",
                        "integration_id": str(self.integration.id),
                    }
                ],
            },
        }

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature({"organizations:context-engine-experiments": True}):
                index_repos(self.org.id)

        mock_mock_make_org_repo_knowledge_index_request.assert_called_once()
        body = mock_mock_make_org_repo_knowledge_index_request.call_args[0][0]
        repos = body["repos"]

        assert len(repos) == 1
        assert repos[0]["name"] == "sentry"
        assert repos[0]["project_ids"] == [self.project1.id]

    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_read_preferences_from_sentry_db")
    @mock.patch("sentry.tasks.seer.context_engine_index.bulk_get_project_preferences")
    @mock.patch("sentry.tasks.seer.context_engine_index.make_org_repo_knowledge_index_request")
    def test_reads_from_sentry_db(
        self,
        mock_make_org_repo_knowledge_index_request,
        mock_bulk_get_preferences,
        mock_bulk_read_db,
    ) -> None:
        """When feature flag enabled, reads preferences from Sentry DB instead of Seer API."""
        mock_make_org_repo_knowledge_index_request.return_value.status = 200
        mock_bulk_read_db.return_value = {
            self.project1.id: SeerProjectPreference(
                organization_id=self.org.id,
                project_id=self.project1.id,
                repositories=[
                    SeerRepoDefinition(
                        provider="integrations:github",
                        owner="getsentry",
                        name="sentry",
                        external_id="123",
                        integration_id=str(self.integration.id),
                    )
                ],
            ),
        }

        with override_options({"explorer.context_engine_indexing.enable": True}):
            with self.feature(
                {
                    "organizations:context-engine-experiments": True,
                    "organizations:seer-project-settings-read-from-sentry": True,
                }
            ):
                index_repos(self.org.id)

        mock_bulk_get_preferences.assert_not_called()
        mock_bulk_read_db.assert_called_once()
        mock_make_org_repo_knowledge_index_request.assert_called_once()
        body = mock_make_org_repo_knowledge_index_request.call_args[0][0]
        repos = body["repos"]
        assert len(repos) == 1
        assert repos[0]["name"] == "sentry"
        assert repos[0]["owner"] == "getsentry"


@django_db_all
class TestScheduleContextEngineIndexingTasks(TestCase):
    @mock.patch("sentry.tasks.seer.context_engine_index.index_repos.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.build_service_map.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.index_org_project_knowledge.apply_async")
    @mock.patch(
        "sentry.tasks.seer.context_engine_index.get_allowed_org_ids_context_engine_indexing"
    )
    def test_dispatches_for_allowed_orgs(
        self, mock_get_orgs, mock_index, mock_build, mock_index_repos
    ):
        org1 = self.create_organization()
        org2 = self.create_organization()
        mock_get_orgs.return_value = [org1.id, org2.id]

        # Freeze to a Wednesday so index_repos is not called
        with freeze_time("2024-01-10 12:00:00"):
            with override_options(
                {
                    "explorer.context_engine_indexing.enable": True,
                }
            ):
                schedule_context_engine_indexing_tasks()

        assert mock_index.call_count == 2
        assert mock_build.call_count == 2
        mock_index_repos.assert_not_called()
        dispatched_index_ids = [c[1]["args"][0] for c in mock_index.call_args_list]
        assert dispatched_index_ids == [org1.id, org2.id]

    @mock.patch("sentry.tasks.seer.context_engine_index.index_repos.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.build_service_map.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.index_org_project_knowledge.apply_async")
    @mock.patch(
        "sentry.tasks.seer.context_engine_index.get_allowed_org_ids_context_engine_indexing"
    )
    def test_dispatches_index_repos_on_sunday(
        self, mock_get_orgs, mock_index, mock_build, mock_index_repos
    ):
        org1 = self.create_organization()
        mock_get_orgs.return_value = [org1.id]

        # Freeze to a Sunday so index_repos is called
        with freeze_time("2024-01-14 12:00:00"):
            with override_options(
                {
                    "explorer.context_engine_indexing.enable": True,
                }
            ):
                schedule_context_engine_indexing_tasks()

        assert mock_index.call_count == 1
        assert mock_build.call_count == 1
        mock_index_repos.assert_called_once_with(args=[org1.id])

    @mock.patch("sentry.tasks.seer.context_engine_index.index_repos.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.build_service_map.apply_async")
    @mock.patch("sentry.tasks.seer.context_engine_index.index_org_project_knowledge.apply_async")
    def test_noop_when_no_allowed_orgs(self, mock_index, mock_build, mock_index_repos):
        with override_options({"explorer.context_engine_indexing.enable": True}):
            schedule_context_engine_indexing_tasks()

        mock_index.assert_not_called()
        mock_build.assert_not_called()
        mock_index_repos.assert_not_called()
