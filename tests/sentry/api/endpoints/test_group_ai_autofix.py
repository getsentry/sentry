from datetime import datetime
from unittest.mock import ANY, Mock, patch

import orjson

from sentry.api.endpoints.group_ai_autofix import TIMEOUT_SECONDS, GroupAutofixEndpoint
from sentry.autofix.utils import AutofixState, AutofixStatus, CodebaseState
from sentry.models.group import Group
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:gen-ai-features")
class GroupAutofixEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/autofix/"

    def setUp(self):
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_with_autofix(self, mock_get_autofix_state):
        group = self.create_group()
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"

        mock_get_autofix_state.assert_called_once_with(group_id=group.id, check_repo_access=True)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_without_autofix(self, mock_get_autofix_state):
        group = self.create_group()
        mock_get_autofix_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

        mock_get_autofix_state.assert_called_once_with(group_id=group.id, check_repo_access=True)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_repositories(
        self, mock_get_sorted_code_mapping_configs, mock_get_autofix_state
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                )
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self):
                self.url = "example.com"
                self.external_id = "id123"
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo(), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert len(response.data["autofix"]["repositories"]) == 1
        repo = response.data["autofix"]["repositories"][0]
        assert repo["default_branch"] == "main"
        assert repo["name"] == "test_repo"
        assert repo["provider"] == "github"
        assert repo["external_id"] == "id123"
        assert repo["url"] == "example.com"
        assert repo["integration_id"] == 42
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is True

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_multiple_repositories(
        self, mock_get_sorted_code_mapping_configs, mock_get_autofix_state
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                ),
                "id456": CodebaseState(
                    repo_external_id="id456",
                    is_readable=True,
                    is_writeable=False,
                ),
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self, external_id, name, provider, url, integration_id):
                self.url = url
                self.external_id = external_id
                self.name = name
                self.provider = provider
                self.integration_id = integration_id

        repo1 = TestRepo("id123", "repo1", "github", "example.com/repo1", 42)
        repo2 = TestRepo("id456", "repo2", "gitlab", "example.com/repo2", 43)

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=repo1, default_branch="main"),
            Mock(repository=repo2, default_branch="master"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert len(response.data["autofix"]["repositories"]) == 2

        repositories = sorted(
            response.data["autofix"]["repositories"], key=lambda x: x["integration_id"]
        )

        # Check first repo
        repo = repositories[0]
        assert repo["default_branch"] == "main"
        assert repo["name"] == "repo1"
        assert repo["provider"] == "github"
        assert repo["external_id"] == "id123"
        assert repo["url"] == "example.com/repo1"
        assert repo["integration_id"] == 42
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is True

        # Check second repo
        repo = repositories[1]
        assert repo["default_branch"] == "master"
        assert repo["name"] == "repo2"
        assert repo["provider"] == "gitlab"
        assert repo["external_id"] == "id456"
        assert repo["url"] == "example.com/repo2"
        assert repo["integration_id"] == 43
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is False

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_repository_not_in_codebase(
        self, mock_get_sorted_code_mapping_configs, mock_get_autofix_state
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                )
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self, external_id):
                self.url = "example.com"
                self.external_id = external_id
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        # Create a repo with a different external_id than what's in the codebase
        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo("different_id"), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        # No repositories should be included since the external_id doesn't match
        assert len(response.data["autofix"]["repositories"]) == 0

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_no_codebases(
        self, mock_get_sorted_code_mapping_configs, mock_get_autofix_state
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            # Empty codebases dictionary
            codebases={},
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self):
                self.url = "example.com"
                self.external_id = "id123"
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo(), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        # Should have empty repositories list since there are no codebases
        assert len(response.data["autofix"]["repositories"]) == 0

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_endpoint(self, mock_check_autofix_status, mock_call):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            None,
            None,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_code_mappings(
        self,
        mock_check_autofix_status,
        mock_call,
    ):
        release = self.create_release(project=self.project, version="1.0.0")

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [],
            ANY,
            None,
            None,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id(
        self,
        mock_check_autofix_status,
        mock_call,
    ):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            None,
            None,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id_no_recommended_event(
        self,
        mock_check_autofix_status,
        mock_call,
        mock_event,
    ):

        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            None,
            None,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.models.Group.get_latest_event", return_value=None)
    def test_ai_autofix_post_without_event_id_error(
        self, mock_latest_event, mock_recommended_event
    ):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        assert response.status_code == 400

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_without_stacktrace(self, mock_call):
        release = self.create_release(project=self.project, version="1.0.0")

        # Creating a repository with a valid name 'getsentry/sentry'
        valid_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        valid_repo.save()

        self.create_commit(project=self.project, release=release, key="1234", repo=valid_repo)

        data = load_data("python", timestamp=before_now(minutes=1))

        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": None,
                "stacktrace": None,
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )
        mock_call.assert_not_called()

        group = Group.objects.get(id=group.id)

        error_msg = "Cannot fix issues without a stacktrace."

        assert response.status_code == 400  # Expecting a Bad Request response for invalid repo
        assert response.data["detail"] == error_msg

    def test_convert_profile_to_execution_tree(self):
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                    {
                        "function": "external",
                        "module": "external.lib",
                        "filename": "lib.py",
                        "lineno": 30,
                        "in_app": False,
                    },
                ],
                "stacks": [
                    [2, 1, 0]
                ],  # One stack with three frames. In a call stack, the first function is the last frame
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree = GroupAutofixEndpoint()._convert_profile_to_execution_tree(profile_data)

        # Should only include in_app frames from MainThread
        assert len(execution_tree) == 1  # One root node
        root = execution_tree[0]
        assert root["function"] == "main"
        assert root["module"] == "app.main"
        assert root["filename"] == "main.py"
        assert root["lineno"] == 10
        assert len(root["children"]) == 1

        child = root["children"][0]
        assert child["function"] == "helper"
        assert child["module"] == "app.utils"
        assert child["filename"] == "utils.py"
        assert child["lineno"] == 20
        assert len(child["children"]) == 0  # No children for the last in_app frame

    def test_convert_profile_to_execution_tree_non_main_thread(self):
        """Test that non-MainThread samples are excluded from execution tree"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "worker",
                        "module": "app.worker",
                        "filename": "worker.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "2"}],
                "thread_metadata": {"2": {"name": "WorkerThread"}},
            }
        }

        execution_tree = GroupAutofixEndpoint()._convert_profile_to_execution_tree(profile_data)

        # Should be empty since no MainThread samples
        assert len(execution_tree) == 0

    def test_convert_profile_to_execution_tree_merges_duplicate_frames(self):
        """Test that duplicate frames in different samples are merged correctly"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0], [0]],  # Two stacks with the same frame
                "samples": [
                    {"stack_id": 0, "thread_id": "1"},
                    {"stack_id": 1, "thread_id": "1"},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree = GroupAutofixEndpoint()._convert_profile_to_execution_tree(profile_data)

        # Should only have one node even though frame appears in multiple samples
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "main"

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_cache_miss(self, mock_cache, mock_get_autofix_state):
        """Test that repo access is checked when cache is empty"""
        # Set up cache miss
        mock_cache.get.return_value = None

        # Set up mock autofix state
        mock_get_autofix_state.return_value = None

        url = self._get_url(self.group.id)
        self.login_as(user=self.user)

        response = self.client.get(url)

        # Verify response
        assert response.status_code == 200

        # Verify cache behavior - cache miss should trigger repo access check
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{self.group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=self.group.id, check_repo_access=True
        )

        # Verify the cache was set with a 60-second timeout
        mock_cache.set.assert_called_once_with(
            f"autofix_access_check:{self.group.id}", True, timeout=60
        )

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_cache_hit(self, mock_cache, mock_get_autofix_state):
        """Test that repo access is not checked when cache has a value"""
        # Set up cache hit
        mock_cache.get.return_value = True

        # Set up mock autofix state
        mock_get_autofix_state.return_value = None

        url = self._get_url(self.group.id)
        self.login_as(user=self.user)

        response = self.client.get(url)

        # Verify response
        assert response.status_code == 200

        # Verify cache behavior - cache hit should skip repo access check
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{self.group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=self.group.id, check_repo_access=False
        )

        # Verify the cache was not set again
        mock_cache.set.assert_not_called()

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_polling_behavior(self, mock_cache, mock_get_autofix_state):
        """Test that polling the endpoint only performs repository access checks once per minute"""
        group = self.create_group()
        url = self._get_url(group.id)
        self.login_as(user=self.user)

        # Mock the autofix state
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        # Simulate first request (cache miss)
        mock_cache.get.return_value = None

        response1 = self.client.get(url)
        assert response1.status_code == 200

        # Verify first request behavior
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(group_id=group.id, check_repo_access=True)
        mock_cache.set.assert_called_once_with(f"autofix_access_check:{group.id}", True, timeout=60)

        # Reset mocks for second request
        mock_cache.reset_mock()
        mock_get_autofix_state.reset_mock()

        # Simulate second request within the 1-minute window (cache hit)
        mock_cache.get.return_value = True

        response2 = self.client.get(url)
        assert response2.status_code == 200

        # Verify second request behavior
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(group_id=group.id, check_repo_access=False)
        mock_cache.set.assert_not_called()

        # Reset mocks for third request
        mock_cache.reset_mock()
        mock_get_autofix_state.reset_mock()

        # Simulate third request after cache expiration (cache miss again)
        mock_cache.get.return_value = None

        response3 = self.client.get(url)
        assert response3.status_code == 200

        # Verify third request behavior - should be like the first request
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(group_id=group.id, check_repo_access=True)
        mock_cache.set.assert_called_once_with(f"autofix_access_check:{group.id}", True, timeout=60)

    def test_get_trace_tree_for_event(self):
        """
        Expected trace structure:

        trace (1234567890abcdef1234567890abcdef)
        ├── another-root-id (09:59:00Z) "browser - Earlier Transaction"
        └── root-tx-id (10:00:00Z) "http.server - Root Transaction"
            ├── child1-tx-id (10:00:10Z) "db - Database Query"
            │   └── grandchild1-error-id (10:00:15Z) "Database Error"
            └── child2-error-id (10:00:20Z) "Division by zero"

        Note: Events are ordered chronologically at each level.
        """
        event_data = load_data("python")
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Root event (a transaction)
        root_tx_span_id = "aaaaaaaaaaaaaaaa"
        root_tx_event_data = {
            "event_id": "root-tx-id",
            "datetime": "2023-01-01T10:00:00Z",
            "spans": [{"span_id": "child1-span-id"}, {"span_id": "child2-span-id"}],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": root_tx_span_id, "op": "http.server"}
            },
            "title": "Root Transaction",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Child 1 - transaction that happens before child 2
        child1_span_id = "child1-span-id"
        child1_tx_event_data = {
            "event_id": "child1-tx-id",
            "datetime": "2023-01-01T10:00:10Z",
            "spans": [{"span_id": "grandchild1-span-id"}],
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child1_span_id,
                    "parent_span_id": root_tx_span_id,
                    "op": "db",
                }
            },
            "title": "Database Query",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Child 2 - error that happens after child 1
        child2_span_id = "child2-span-id"
        child2_error_event_data = {
            "event_id": "child2-error-id",
            "datetime": "2023-01-01T10:00:20Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child2_span_id,
                    "parent_span_id": root_tx_span_id,
                }
            },
            "title": "Division by zero",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Grandchild 1 - error event (child of child1)
        grandchild1_span_id = "grandchild1-span-id"
        grandchild1_error_event_data = {
            "event_id": "grandchild1-error-id",
            "datetime": "2023-01-01T10:00:15Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": grandchild1_span_id,
                    "parent_span_id": child1_span_id,
                }
            },
            "title": "Database Error",
            "platform": "python",
            "project_id": self.project.id,
        }

        # Add another root event that happens earlier
        another_root_span_id = "bbbbbbbbbbbbbbbb"
        another_root_tx_event_data = {
            "event_id": "another-root-id",
            "datetime": "2023-01-01T09:59:00Z",
            "spans": [],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": another_root_span_id, "op": "browser"}
            },
            "title": "Earlier Transaction",
            "platform": "javascript",
            "project_id": self.project.id,
        }

        # Create proper event objects instead of just mocks
        tx_events = []
        error_events = []

        # Create transaction events
        for event_data in [root_tx_event_data, child1_tx_event_data, another_root_tx_event_data]:
            mock_event = Mock()
            # Set attributes directly instead of using data property
            mock_event.event_id = event_data["event_id"]
            mock_event.datetime = datetime.fromisoformat(
                event_data["datetime"].replace("Z", "+00:00")
            )
            mock_event.data = event_data
            mock_event.title = event_data["title"]
            mock_event.platform = event_data["platform"]
            mock_event.project_id = event_data["project_id"]
            mock_event.trace_id = trace_id
            tx_events.append(mock_event)

        # Create error events
        for event_data in [child2_error_event_data, grandchild1_error_event_data]:
            mock_event = Mock()
            # Set attributes directly instead of using data property
            mock_event.event_id = event_data["event_id"]
            mock_event.datetime = datetime.fromisoformat(
                event_data["datetime"].replace("Z", "+00:00")
            )
            mock_event.data = event_data
            mock_event.title = event_data["title"]
            mock_event.platform = event_data["platform"]
            mock_event.project_id = event_data["project_id"]
            mock_event.trace_id = trace_id
            error_events.append(mock_event)

        # Update to patch both Transactions and Events dataset calls
        with patch("sentry.eventstore.backend.get_events") as mock_get_events:

            def side_effect(filter, dataset, **kwargs):
                if dataset == Dataset.Transactions:
                    return tx_events
                elif dataset == Dataset.Events:
                    return error_events
                return []

            mock_get_events.side_effect = side_effect

            endpoint = GroupAutofixEndpoint()
            trace_tree = endpoint._get_trace_tree_for_event(event, self.project)

        # Validate the trace tree structure
        assert trace_tree is not None
        assert trace_tree["trace_id"] == trace_id

        # We should have two root events in chronological order
        assert len(trace_tree["events"]) == 2

        # First root should be the earlier transaction
        first_root = trace_tree["events"][0]
        assert first_root["event_id"] == "another-root-id"
        assert first_root["title"] == "browser - Earlier Transaction"
        assert first_root["datetime"].isoformat() == "2023-01-01T09:59:00+00:00"
        assert first_root["is_transaction"] is True
        assert first_root["is_error"] is False
        assert len(first_root["children"]) == 0

        # Second root should be the main root transaction
        second_root = trace_tree["events"][1]
        assert second_root["event_id"] == "root-tx-id"
        assert second_root["title"] == "http.server - Root Transaction"
        assert second_root["datetime"].isoformat() == "2023-01-01T10:00:00+00:00"
        assert second_root["is_transaction"] is True
        assert second_root["is_error"] is False

        # Second root should have two children in chronological order
        assert len(second_root["children"]) == 2

        # First child of main root is child1
        child1 = second_root["children"][0]
        assert child1["event_id"] == "child1-tx-id"
        assert child1["title"] == "db - Database Query"
        assert child1["datetime"].isoformat() == "2023-01-01T10:00:10+00:00"
        assert child1["is_transaction"] is True
        assert child1["is_error"] is False

        # Child1 should have grandchild1
        assert len(child1["children"]) == 1
        grandchild1 = child1["children"][0]
        assert grandchild1["event_id"] == "grandchild1-error-id"
        assert grandchild1["title"] == "Database Error"
        assert grandchild1["datetime"].isoformat() == "2023-01-01T10:00:15+00:00"
        assert grandchild1["is_transaction"] is False
        assert grandchild1["is_error"] is True
        assert len(grandchild1["children"]) == 0

        # Second child of main root is child2
        child2 = second_root["children"][1]
        assert child2["event_id"] == "child2-error-id"
        assert child2["title"] == "Division by zero"
        assert child2["datetime"].isoformat() == "2023-01-01T10:00:20+00:00"
        assert child2["is_transaction"] is False
        assert child2["is_error"] is True
        assert len(child2["children"]) == 0

        # Verify that get_events was called twice - once for transactions and once for errors
        assert mock_get_events.call_count == 2
        # Check that the first call used the Transactions dataset
        assert mock_get_events.call_args_list[0][1]["dataset"] == Dataset.Transactions
        # Check that the second call used the Events dataset
        assert mock_get_events.call_args_list[1][1]["dataset"] == Dataset.Events

    @patch("sentry.eventstore.backend.get_events")
    def test_get_trace_tree_empty_results(self, mock_get_events):
        """
        Expected trace structure:

        None (empty trace tree)

        This test checks the behavior when no events are found for a trace.
        """
        mock_get_events.return_value = []

        event_data = load_data("python")
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        endpoint = GroupAutofixEndpoint()
        trace_tree = endpoint._get_trace_tree_for_event(event, self.project)

        assert trace_tree is None
        # Should be called twice - once for transactions and once for errors
        assert mock_get_events.call_count == 2

    @patch("sentry.eventstore.backend.get_events")
    def test_get_trace_tree_out_of_order_processing(self, mock_get_events):
        """
        Expected trace structure:

        trace (1234567890abcdef1234567890abcdef)
        └── parent-id (10:00:00Z) "Parent Last"
            └── child-id (10:00:10Z) "Child First"

        This test verifies that the correct tree structure is built even when
        events are processed out of order (child before parent).
        """
        trace_id = "1234567890abcdef1234567890abcdef"
        test_span_id = "abcdef0123456789"
        event_data = load_data("python")
        event_data.update({"contexts": {"trace": {"trace_id": trace_id, "span_id": test_span_id}}})
        event = self.store_event(data=event_data, project_id=self.project.id)

        # Child event that references a parent we haven't seen yet
        child_span_id = "cccccccccccccccc"
        parent_span_id = "pppppppppppppppp"

        # Create proper child event object
        child_event = Mock()
        child_event.event_id = "child-id"
        child_event.datetime = datetime.fromisoformat("2023-01-01T10:00:10+00:00")
        child_event.data = {
            "event_id": "child-id",
            "datetime": "2023-01-01T10:00:10Z",
            "contexts": {
                "trace": {
                    "trace_id": trace_id,
                    "span_id": child_span_id,
                    "parent_span_id": parent_span_id,
                }
            },
            "title": "Child First",
            "platform": "python",
            "project_id": self.project.id,
        }
        child_event.title = "Child First"
        child_event.platform = "python"
        child_event.project_id = self.project.id
        child_event.trace_id = trace_id

        # Create proper parent event object
        parent_event = Mock()
        parent_event.event_id = "parent-id"
        parent_event.datetime = datetime.fromisoformat("2023-01-01T10:00:00+00:00")
        parent_event.data = {
            "event_id": "parent-id",
            "datetime": "2023-01-01T10:00:00Z",
            "spans": [],
            "contexts": {
                "trace": {"trace_id": trace_id, "span_id": parent_span_id, "op": "http.server"}
            },
            "title": "Parent Last",
            "platform": "python",
            "project_id": self.project.id,
        }
        parent_event.title = "Parent Last"
        parent_event.platform = "python"
        parent_event.project_id = self.project.id
        parent_event.trace_id = trace_id

        # Set up the mock to return different results for different dataset calls
        def side_effect(filter, dataset, **kwargs):
            if dataset == Dataset.Transactions:
                return [parent_event]  # Parent is a transaction
            elif dataset == Dataset.Events:
                return [child_event]  # Child is an error
            return []

        mock_get_events.side_effect = side_effect

        endpoint = GroupAutofixEndpoint()
        trace_tree = endpoint._get_trace_tree_for_event(event, self.project)

        assert trace_tree is not None
        assert len(trace_tree["events"]) == 1

        # Parent should be the root
        root = trace_tree["events"][0]
        assert root["event_id"] == "parent-id"
        assert root["span_id"] == parent_span_id

        # Child should be under parent
        assert len(root["children"]) == 1
        child = root["children"][0]
        assert child["event_id"] == "child-id"
        assert child["span_id"] == child_span_id

        # Verify that get_events was called twice
        assert mock_get_events.call_count == 2

    @patch("sentry.api.endpoints.group_ai_autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method which finds a profile for a transaction
        that is a parent of an error event in a trace tree.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with a transaction that has a profile_id
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "tx-root-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,
                    "children": [
                        {
                            "event_id": "error-event-id",
                            "span_id": "event-span-id",
                            "is_transaction": False,
                            "is_error": True,
                            "children": [],
                        }
                    ],
                }
            ],
        }

        # Mock the profile data response
        mock_profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        # Configure the mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        endpoint = GroupAutofixEndpoint()
        profile_result = endpoint._get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert profile_result["profile_matches_issue"] is True
        assert "execution_tree" in profile_result
        assert len(profile_result["execution_tree"]) == 1
        assert profile_result["execution_tree"][0]["function"] == "main"

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    @patch("sentry.api.endpoints.group_ai_autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree_api_error(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method when the profiling service API returns an error.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with a transaction that has a profile_id
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "tx-root-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,
                    "children": [
                        {
                            "event_id": "error-event-id",
                            "span_id": "event-span-id",
                            "is_transaction": False,
                            "is_error": True,
                            "children": [],
                        }
                    ],
                }
            ],
        }

        # Configure the mock response to simulate an API error
        mock_response = Mock()
        mock_response.status = 404
        mock_get_from_profiling_service.return_value = mock_response

        endpoint = GroupAutofixEndpoint()
        profile_result = endpoint._get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is None

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    @patch("sentry.api.endpoints.group_ai_autofix.get_from_profiling_service")
    def test_get_profile_from_trace_tree_multi_level(self, mock_get_from_profiling_service):
        """
        Test the _get_profile_from_trace_tree method with a multi-level trace tree
        where the profile is found in a grandparent transaction.
        """
        event = Mock()
        event.event_id = "error-event-id"
        event.trace_id = "1234567890abcdef1234567890abcdef"

        # Create a mock trace tree with multiple levels
        profile_id = "profile123456789"
        trace_tree = {
            "trace_id": "1234567890abcdef1234567890abcdef",
            "events": [
                {
                    "event_id": "root-tx-id",
                    "span_id": "root-span-id",
                    "is_transaction": True,
                    "is_error": False,
                    "profile_id": profile_id,  # Profile is at the root level
                    "children": [
                        {
                            "event_id": "mid-tx-id",
                            "span_id": "mid-span-id",
                            "is_transaction": True,
                            "is_error": False,
                            # No profile_id at this level
                            "children": [
                                {
                                    "event_id": "error-event-id",
                                    "span_id": "event-span-id",
                                    "is_transaction": False,
                                    "is_error": True,
                                    "children": [],
                                }
                            ],
                        }
                    ],
                }
            ],
        }

        # Mock the profile data response
        mock_profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "1"}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        # Configure the mock response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(mock_profile_data)
        mock_get_from_profiling_service.return_value = mock_response

        endpoint = GroupAutofixEndpoint()
        profile_result = endpoint._get_profile_from_trace_tree(trace_tree, event, self.project)

        assert profile_result is not None
        assert profile_result["profile_matches_issue"] is True
        assert "execution_tree" in profile_result

        mock_get_from_profiling_service.assert_called_once_with(
            "GET",
            f"/organizations/{self.project.organization_id}/projects/{self.project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )
