from django.urls import reverse

from sentry.integrations.api.endpoints.organization_code_mappings import BRANCH_NAME_ERROR_MESSAGE
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


class OrganizationCodeMappingsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.user2 = self.create_user("nisanthan@sentry.io", is_superuser=False)
        self.team = self.create_team(
            organization=self.organization, name="Mariachi Band", members=[self.user]
        )
        self.team2 = self.create_team(
            organization=self.organization,
            name="Ecosystem",
        )
        self.create_member(
            organization=self.organization,
            user=self.user2,
            has_global_access=False,
            teams=[self.team2],
        )
        self.project1 = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team, self.team2], name="Tiger"
        )
        self.repo1 = Repository.objects.create(
            name="example", organization_id=self.organization.id, integration_id=self.integration.id
        )
        self.url = reverse(
            "sentry-api-0-organization-code-mappings",
            args=[self.organization.slug],
        )

    def make_post(self, data=None):
        config_data = {
            "repositoryId": self.repo1.id,
            "projectId": self.project1.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
            "integrationId": self.integration.id,
        }
        if data:
            config_data.update(data)
        return self.client.post(self.url, data=config_data, format="json")

    def test_basic_get_with_integrationId(self) -> None:
        path_config1 = self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="stack/root",
            source_root="source/root",
        )
        path_config2 = self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            stack_root="another/path",
            source_root="hey/there",
        )

        url_path = f"{self.url}?integrationId={self.integration.id}"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 200, response.content

        assert response.data[0] == {
            "automaticallyGenerated": False,
            "id": str(path_config1.id),
            "projectId": str(self.project1.id),
            "projectSlug": self.project1.slug,
            "repoId": str(self.repo1.id),
            "repoName": self.repo1.name,
            "provider": {
                "aspects": {},
                "features": [
                    "codeowners",
                    "commits",
                    "issue-basic",
                    "issue-sync",
                    "stacktrace-link",
                ],
                "name": "GitHub",
                "canDisable": False,
                "key": "github",
                "slug": "github",
                "canAdd": True,
            },
            "integrationId": str(self.integration.id),
            "stackRoot": "stack/root",
            "sourceRoot": "source/root",
            "defaultBranch": "master",
        }

        assert response.data[1] == {
            "automaticallyGenerated": False,
            "id": str(path_config2.id),
            "projectId": str(self.project2.id),
            "projectSlug": self.project2.slug,
            "repoId": str(self.repo1.id),
            "repoName": self.repo1.name,
            "provider": {
                "aspects": {},
                "features": [
                    "codeowners",
                    "commits",
                    "issue-basic",
                    "issue-sync",
                    "stacktrace-link",
                ],
                "name": "GitHub",
                "canDisable": False,
                "key": "github",
                "slug": "github",
                "canAdd": True,
            },
            "integrationId": str(self.integration.id),
            "stackRoot": "another/path",
            "sourceRoot": "hey/there",
            "defaultBranch": "master",
        }

    def test_basic_get_with_projectId(self) -> None:
        path_config1 = self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="stack/root",
            source_root="source/root",
            default_branch="master",
        )

        url_path = f"{self.url}?project={self.project1.id}"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 200, response.content

        assert response.data[0] == {
            "automaticallyGenerated": False,
            "id": str(path_config1.id),
            "projectId": str(self.project1.id),
            "projectSlug": self.project1.slug,
            "repoId": str(self.repo1.id),
            "repoName": self.repo1.name,
            "provider": {
                "aspects": {},
                "features": [
                    "codeowners",
                    "commits",
                    "issue-basic",
                    "issue-sync",
                    "stacktrace-link",
                ],
                "name": "GitHub",
                "canDisable": False,
                "key": "github",
                "slug": "github",
                "canAdd": True,
            },
            "integrationId": str(self.integration.id),
            "stackRoot": "stack/root",
            "sourceRoot": "source/root",
            "defaultBranch": "master",
        }

    def test_basic_get_with_no_integrationId_and_projectId(self) -> None:

        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="stack/root",
            source_root="source/root",
            default_branch="master",
        )
        self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            stack_root="another/path",
            source_root="hey/there",
        )

        url_path = f"{self.url}"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_basic_get_with_invalid_integrationId(self) -> None:

        url_path = f"{self.url}?integrationId=100"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 404, response.content

    def test_basic_get_with_invalid_projectId(self) -> None:

        url_path = f"{self.url}?project=100"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 403, response.content

    def test_basic_get_with_projectId_minus_1(self) -> None:
        self.login_as(user=self.user2)
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="stack/root",
            source_root="source/root",
            default_branch="master",
        )
        self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            stack_root="another/path",
            source_root="hey/there",
        )
        url_path = f"{self.url}?projectId=-1"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

    def test_basic_post_with_valid_integrationId(self) -> None:
        response = self.make_post()
        assert response.status_code == 201, response.content
        assert response.data == {
            "automaticallyGenerated": False,
            "id": str(response.data["id"]),
            "projectId": str(self.project1.id),
            "projectSlug": self.project1.slug,
            "repoId": str(self.repo1.id),
            "repoName": self.repo1.name,
            "provider": {
                "aspects": {},
                "features": [
                    "codeowners",
                    "commits",
                    "issue-basic",
                    "issue-sync",
                    "stacktrace-link",
                ],
                "name": "GitHub",
                "canDisable": False,
                "key": "github",
                "slug": "github",
                "canAdd": True,
            },
            "integrationId": str(self.integration.id),
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
        }

    def test_basic_post_from_member_permissions(self) -> None:
        self.login_as(user=self.user2)
        response = self.make_post()
        assert response.status_code == 201, response.content

    def test_basic_post_from_non_member_permissions(self) -> None:
        # disable open membership => no project level access
        # user2 is not in a team1 that has access to project1
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(user=self.user2)
        response = self.make_post()
        assert response.status_code == 403, response.content

    def test_basic_post_with_invalid_integrationId(self) -> None:
        response = self.make_post({"integrationId": 100})
        assert response.status_code == 404, response.content

    def test_basic_post_with_no_integrationId(self) -> None:
        response = self.make_post({"integrationId": None})
        assert response.status_code == 400, response.content
        assert response.data == "Missing param: integrationId"

    def test_empty_roots_post(self) -> None:
        response = self.make_post({"stackRoot": "", "sourceRoot": ""})
        assert response.status_code == 201, response.content

    def test_invalid_project_id(self) -> None:
        response = self.make_post({"projectId": "dogs_are_great"})
        assert response.status_code == 400, response.content
        assert response.data == "Invalid projectId param. Expected an integer."

    def test_project_does_not_exist(self) -> None:
        bad_org = self.create_organization()
        bad_project = self.create_project(organization=bad_org)
        response = self.make_post({"projectId": bad_project.id})
        assert response.status_code == 400
        assert response.data == {"projectId": ["Project does not exist"]}

    def test_repo_does_not_exist_on_given_integrationId(self) -> None:
        bad_integration = self.create_integration(
            organization=self.organization,
            external_id="radsfas",
            provider="github",
        )
        bad_repo = Repository.objects.create(
            name="another", organization_id=self.organization.id, integration_id=bad_integration.id
        )
        response = self.make_post(
            {"repositoryId": bad_repo.id, "integrationId": self.integration.id}
        )

        assert response.status_code == 400
        assert response.data == {"repositoryId": ["Repository does not exist"]}

    def test_repo_does_not_exist_on_given_organization(self) -> None:
        bad_org = self.create_organization(owner=self.user, name="foo")
        bad_integration = self.create_integration(
            organization=bad_org, provider="github", external_id="radsfas"
        )
        bad_repo = Repository.objects.create(
            name="another", organization_id=bad_org.id, integration_id=bad_integration.id
        )
        response = self.make_post({"repositoryId": bad_repo.id})

        assert response.status_code == 400
        assert response.data == {"repositoryId": ["Repository does not exist"]}

    def test_validate_path_conflict(self) -> None:
        self.make_post()
        response = self.make_post()
        assert response.status_code == 400
        assert response.data == {
            "nonFieldErrors": [
                "Code path config already exists with this project and stack trace root"
            ]
        }

    def test_space_in_stack_root(self) -> None:
        response = self.make_post({"stackRoot": "has space"})
        assert response.status_code == 400
        assert response.data == {
            "stackRoot": ["Path may not contain spaces or quotations"],
        }

    def test_space_in_source_root(self) -> None:
        response = self.make_post({"sourceRoot": "has space"})
        assert response.status_code == 400
        assert response.data == {
            "sourceRoot": ["Path may not contain spaces or quotations"],
        }

    def test_quote_in_stack_root(self) -> None:
        response = self.make_post({"stackRoot": "f'f"})
        assert response.status_code == 400
        assert response.data == {
            "stackRoot": ["Path may not contain spaces or quotations"],
        }

    def test_quote_in_branch(self) -> None:
        response = self.make_post({"defaultBranch": "f'f"})
        assert response.status_code == 400
        assert response.data == {"defaultBranch": [BRANCH_NAME_ERROR_MESSAGE]}

    def test_forward_slash_in_branch(self) -> None:
        response = self.make_post({"defaultBranch": "prod/deploy-branch"})
        assert response.status_code == 201, response.content

    def test_period_in_branch(self) -> None:
        response = self.make_post({"defaultBranch": "release-2.0.0"})
        assert response.status_code == 201, response.content

    def test_leading_forward_slash_in_branch_conflict(self) -> None:
        response = self.make_post({"defaultBranch": "/prod/deploy-branch"})
        assert response.status_code == 400
        assert response.data == {"defaultBranch": [BRANCH_NAME_ERROR_MESSAGE]}

    def test_ending_forward_slash_in_branch_conflict(self) -> None:
        response = self.make_post({"defaultBranch": "prod/deploy-branch/"})
        assert response.status_code == 400
        assert response.data == {"defaultBranch": [BRANCH_NAME_ERROR_MESSAGE]}

    def test_get_with_integration_from_another_org_returns_404(self) -> None:
        """GET with integrationId from another organization returns 404."""
        other_org = self.create_organization(name="other-org")
        other_integration = self.create_integration(
            organization=other_org,
            external_id="other-external-id",
            provider="github",
        )

        url_path = f"{self.url}?integrationId={other_integration.id}"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 404, response.content

    def test_get_with_integrationId_enforces_project_access(self) -> None:
        """GET with integrationId only returns mappings for projects user can access."""
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user2 is only on team2, which has access to project2 but not project1
        self.login_as(user=self.user2)

        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="inaccessible/path",
            source_root="source/root",
        )
        accessible_mapping = self.create_code_mapping(
            project=self.project2,
            repo=self.repo1,
            stack_root="accessible/path",
            source_root="source/root",
        )

        url_path = f"{self.url}?integrationId={self.integration.id}"
        response = self.client.get(url_path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(accessible_mapping.id)
        assert response.data[0]["projectId"] == str(self.project2.id)
