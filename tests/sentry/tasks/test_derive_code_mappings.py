from copy import deepcopy
from typing import Dict, List, Union
from unittest.mock import patch

import pytest
import responses

from sentry.integrations.utils.code_mapping import CodeMapping, Repo, RepoTree
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import OrganizationStatus
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.tasks.derive_code_mappings import derive_code_mappings, identify_stacktrace_paths
from sentry.testutils import TestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls, with_feature
from sentry.utils.locking import UnableToAcquireLock


class BaseDeriveCodeMappings(TestCase):
    def setUp(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE,
        )
        self.project = self.create_project(organization=self.organization)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
            metadata={"domain_name": "github.com/Test-Org"},
        )

    def generate_data(self, frames: List[Dict[str, Union[str, bool]]], platform: str = ""):
        test_data = {"platform": platform or self.platform, "stacktrace": {"frames": frames}}
        return self.store_event(data=test_data, project_id=self.project.id).data


@apply_feature_flag_on_cls("organizations:derive-code-mappings")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self):
        super().setUp()
        self.platform = "any"
        self.event_data = self.generate_data(
            [{"filename": "foo.py", "in_app": True}],
            platform="any",
        )

    def test_does_not_raise_installation_removed(self):
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org",
            side_effect=ApiError(
                '{"message":"Not Found","documentation_url":"https://docs.github.com/rest/reference/apps#create-an-installation-access-token-for-an-app"}'
            ),
        ):
            assert derive_code_mappings(self.project.id, self.event_data) is None

    @patch("sentry.tasks.derive_code_mappings.logger")
    def test_raises_other_api_errors(self, mock_logger):
        with patch("sentry.tasks.derive_code_mappings.SUPPORTED_LANGUAGES", ["other"]):
            with patch(
                "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org",
                side_effect=ApiError("foo"),
            ):
                derive_code_mappings(self.project.id, self.event_data)
                assert mock_logger.exception.call_count == 1

    def test_unable_to_get_lock(self):
        with patch("sentry.tasks.derive_code_mappings.SUPPORTED_LANGUAGES", ["other"]):
            with patch(
                "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org",
                side_effect=UnableToAcquireLock,
            ):
                # We should raise an exception since the request will be retried
                with pytest.raises(UnableToAcquireLock):
                    derive_code_mappings(self.project.id, self.event_data)


class TestJavascriptDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "javascript"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "../node_modules/@sentry/browser/node_modules/@sentry/core/esm/hub.js",
                    "in_app": False,
                },
                {
                    "filename": "./app/utils/handleXhrErrorResponse.tsx",
                    "in_app": True,
                },
                {
                    "filename": "some/path/Test.tsx",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {
            "./app/utils/handleXhrErrorResponse.tsx",
            "some/path/Test.tsx",
        }

    def test_find_stacktrace_empty(self):
        data = self.generate_data([{}])
        data["stacktrace"]["frames"] = [None]
        stacktrace_paths = identify_stacktrace_paths(data)
        assert stacktrace_paths == []

    def test_find_stacktrace_paths_bad_data(self):
        data = self.generate_data([{}])
        data["stacktrace"]["frames"] = [
            {
                "abs_path": "https://example.com/static/chunks/foo.bar.js",
                "data": {"sourcemap": "https://example.com/_next/static/chunks/foo.bar.js.map"},
                "in_app": True,
            }
        ]
        stacktrace_paths = identify_stacktrace_paths(data)
        assert stacktrace_paths == []

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_starts_with_period_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"),
                    ["static/app/utils/handleXhrErrorResponse.tsx"],
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> static/app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == "static/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_starts_with_period_slash_no_containing_directory(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"),
                    ["app/utils/handleXhrErrorResponse.tsx"],
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_one_to_one_match(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["some/path/Test.tsx"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # some/path/Test.tsx -> Test.tsx -> some/path/Test.tsx
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestRubyDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "ruby"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "some/path/test.rb",
                    "in_app": True,
                },
                {
                    "filename": "lib/tasks/crontask.rake",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {"some/path/test.rb", "lib/tasks/crontask.rake"}

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_rb(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["some/path/test.rb"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_rake(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["lib/tasks/crontask.rake"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestNodeDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "node"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "app:///utils/errors.js",
                    "in_app": True,
                },
                {
                    "filename": "../../../../../../packages/api/src/response.ts",
                    "in_app": True,
                },
                {
                    "filename": "app:///../services/event/EventLifecycle/index.js",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {
            "app:///utils/errors.js",
            "../../../../../../packages/api/src/response.ts",
            "app:///../services/event/EventLifecycle/index.js",
        }

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_starts_with_app(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["utils/errors.js"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_starts_with_multiple_dot_dot_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["packages/api/src/response.ts"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "../../../../../../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_starts_with_app_dot_dot_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"), ["services/event/EventLifecycle/index.js"]
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestPythonDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.test_data = {
            "platform": "python",
            "stacktrace": {
                "frames": [
                    {"in_app": True, "filename": "sentry/tasks.py"},
                    {"in_app": True, "filename": "sentry/models/release.py"},
                ]
            },
        }

    def test_finds_stacktrace_paths_single_project(self):
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        stacktrace_paths = identify_stacktrace_paths(event.data)
        assert sorted(stacktrace_paths) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_handle_duplicate_filenames_in_stacktrace(self):
        data = deepcopy(self.test_data)
        data["stacktrace"]["frames"].append(self.test_data["stacktrace"]["frames"][0])
        event = self.store_event(data=data, project_id=self.project.id)

        stacktrace_paths = identify_stacktrace_paths(event.data)
        assert sorted(stacktrace_paths) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    @with_feature({"organizations:derive-code-mappings": False})
    def test_feature_off(self):
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value={
                self.project: ["sentry/models/release.py", "sentry/tasks.py"],
            },
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 0
        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    @patch(
        "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=Repo(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_single_project(
        self, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value=["sentry/models/release.py", "sentry/tasks.py"],
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)
        assert code_mapping.exists()
        assert code_mapping.first().automatically_generated is True

    def test_skips_not_supported_platforms(self):
        data = self.generate_data([{}], platform="elixir")
        assert derive_code_mappings(self.project.id, data) is None
        assert len(RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)) == 0

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    @patch(
        "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=Repo(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    @patch("sentry.tasks.derive_code_mappings.logger")
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_duplicates(
        self, mock_logger, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        organization_integration = OrganizationIntegration.objects.get(
            organization=self.organization, integration=self.integration
        )
        repository = Repository.objects.create(
            name="repo",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
        event = self.store_event(data=self.test_data, project_id=self.project.id)
        RepositoryProjectPathConfig.objects.create(
            project=self.project,
            stack_root="sentry/models",
            source_root="src/sentry/models",
            repository=repository,
            organization_integration=organization_integration,
        )

        assert RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value=["sentry/models/release.py", "sentry/tasks.py"],
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)
        assert code_mapping.exists()
        assert code_mapping.first().automatically_generated is False
        assert mock_logger.info.call_count == 1

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_stack_and_source_root_do_not_match(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["src/sentry/models/release.py"])
            }
            derive_code_mappings(self.project.id, self.test_data)
            code_mapping = RepositoryProjectPathConfig.objects.all().first()
            # sentry/models/release.py -> models/release.py -> src/sentry/models/release.py
            assert code_mapping.stack_root == "sentry/"
            assert code_mapping.source_root == "src/sentry/"

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_no_normalization(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/models/release.py"])
            }
            derive_code_mappings(self.project.id, self.test_data)
            code_mapping = RepositoryProjectPathConfig.objects.all().first()
            # sentry/models/release.py -> models/release.py -> sentry/models/release.py
            # If the normalization code was used these would be the empty stack root
            assert code_mapping.stack_root == "sentry/"
            assert code_mapping.source_root == "sentry/"
