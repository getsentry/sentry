from unittest.mock import ANY, patch

from sentry.api.endpoints.group_ai_autofix import TIMEOUT_SECONDS, GroupAiAutofixEndpoint
from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@region_silo_test
@apply_feature_flag_on_cls("projects:ai-autofix")
class GroupAIAutofixEndpointTest(APITestCase, SnubaTestCase):
    def test_ai_autofix_get_endpoint_with_autofix(self):
        group = self.create_group()
        metadata = {
            "autofix": {
                "status": "PROCESSING",
            }
        }
        group.data["metadata"] = metadata
        group.save()

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/ai-autofix/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"

    def test_ai_autofix_get_endpoint_without_autofix(self):
        group = self.create_group()
        metadata = {
            "autofix": None,
        }
        group.data["metadata"] = metadata
        group.save()

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/ai-autofix/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

    def test_ai_autofix_post_endpoint(self):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
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

        url = f"/api/0/issues/{group.id}/ai-autofix/"
        self.login_as(user=self.user)
        with patch(
            "sentry.api.endpoints.group_ai_autofix.GroupAiAutofixEndpoint._call_autofix"
        ) as mock_call:
            response = self.client.post(
                url, data={"instruction": "Yes", "event_id": event.event_id}, format="json"
            )
            mock_call.assert_called_with(
                ANY,
                group,
                [
                    {
                        "provider": "integrations:github",
                        "owner": "getsentry",
                        "name": "sentry",
                    }
                ],
                ANY,
                "Yes",
                TIMEOUT_SECONDS,
            )

            actual_group_arg = mock_call.call_args[0][1]
            assert actual_group_arg.id == group.id

            serialized_event_arg = mock_call.call_args[0][3]
            assert any(
                [
                    entry.get("type") == "exception"
                    for entry in serialized_event_arg.get("entries", [])
                ]
            )

        group = Group.objects.get(id=group.id)

        assert response.status_code == 202
        assert "autofix" in group.data["metadata"]
        assert group.data["metadata"]["autofix"]["status"] == "PROCESSING"

    def test_ai_autofix_without_code_mapping(self):
        release = self.create_release(project=self.project, version="1.0.0")

        self.create_repo(
            project=self.project, name="invalid-repo", provider="integrations:someotherprovider"
        )

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

        url = f"/api/0/issues/{group.id}/ai-autofix/"
        self.login_as(user=self.user)

        with patch(
            "sentry.api.endpoints.group_ai_autofix.GroupAiAutofixEndpoint._call_autofix"
        ) as mock_call:
            response = self.client.post(
                url, data={"instruction": "Yes", "event_id": event.event_id}, format="json"
            )
            mock_call.assert_not_called()

        group = Group.objects.get(id=group.id)

        error_msg = "Found no Github repositories linked to this project. Please set up the Github Integration and code mappings if you haven't"

        assert response.status_code == 400  # Expecting a Bad Request response for invalid repo
        assert response.data["detail"] == error_msg

        assert "autofix" in group.data["metadata"]
        assert group.data["metadata"]["autofix"]["status"] == "ERROR"
        assert group.data["metadata"]["autofix"]["error_message"] == error_msg
        assert group.data["metadata"]["autofix"]["steps"] == []

    def test_ai_autofix_without_stacktrace(self):
        release = self.create_release(project=self.project, version="1.0.0")

        # Creating a repository with a valid name 'getsentry/sentry'
        valid_repo = self.create_repo(
            project=self.project, name="getsentry/sentry", provider="integrations:github"
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

        url = f"/api/0/issues/{group.id}/ai-autofix/"
        self.login_as(user=self.user)

        with patch(
            "sentry.api.endpoints.group_ai_autofix.GroupAiAutofixEndpoint._call_autofix"
        ) as mock_call:
            response = self.client.post(
                url, data={"instruction": "Yes", "event_id": event.event_id}, format="json"
            )
            mock_call.assert_not_called()

        group = Group.objects.get(id=group.id)

        error_msg = "Cannot fix issues without a stacktrace."

        assert response.status_code == 400  # Expecting a Bad Request response for invalid repo
        assert response.data["detail"] == error_msg

        assert "autofix" in group.data["metadata"]
        assert group.data["metadata"]["autofix"]["status"] == "ERROR"
        assert group.data["metadata"]["autofix"]["error_message"] == error_msg
        assert group.data["metadata"]["autofix"]["steps"] == []

    def test_get_repos_from_code_mapping_no_repos(self):
        group = self.create_group(project=self.project)
        repos = GroupAiAutofixEndpoint._get_repos_from_code_mapping(group)
        assert len(repos) == 0, "Expected no repositories to be returned when none are linked"

    def test_get_repos_from_code_mapping_with_repos(self):
        group = self.create_group(project=self.project)

        # Creating a repository and linking it to the project
        repo1 = self.create_repo(
            project=self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.create_code_mapping(repo=repo1, stack_root="app")

        repo2 = self.create_repo(
            project=self.project, name="getsentry/sentry-cli", provider="integrations:github"
        )
        self.create_code_mapping(repo=repo2, stack_root="src")

        repos = GroupAiAutofixEndpoint._get_repos_from_code_mapping(group)
        assert len(repos) == 2, "Expected two repositories to be returned"
        assert {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry",
        } in repos, "Expected repo1 to be in the returned list"
        assert {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry-cli",
        } in repos, "Expected repo2 to be in the returned list"

    def test_get_repos_from_code_mapping_with_duplicate_repos(self):
        group = self.create_group(project=self.project)

        # Creating a repository and linking it to the project
        repo1 = self.create_repo(
            project=self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.create_code_mapping(repo=repo1, stack_root="app")

        repo2 = self.create_repo(
            project=self.project, name="getsentry/sentry", provider="integrations:github"
        )
        self.create_code_mapping(repo=repo2, stack_root="src")

        repos = GroupAiAutofixEndpoint._get_repos_from_code_mapping(group)
        assert len(repos) == 1, "Expected one repository to be returned"
        assert {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry",
        } in repos

    def test_get_repos_from_code_mapping_with_invalid_provider(self):
        group = self.create_group(project=self.project)

        # Creating a repository and linking it to the project
        repo1 = self.create_repo(project=self.project, name="getsentry/sentry", provider=None)
        self.create_code_mapping(repo=repo1, stack_root="app")

        repos = GroupAiAutofixEndpoint._get_repos_from_code_mapping(group)
        assert len(repos) == 0
