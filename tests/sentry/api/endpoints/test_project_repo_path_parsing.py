from django.urls import reverse
from rest_framework.response import Response

from sentry.api.endpoints.project_repo_path_parsing import PathMappingSerializer
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User as SentryUser


class BaseStacktraceLinkTest(APITestCase):
    def setUp(self) -> None:
        self.org = self.create_organization(owner=self.user, name="blap")
        self.project = self.create_project(
            name="foo", organization=self.org, teams=[self.create_team(organization=self.org)]
        )

    def make_post(
        self,
        source_url: str,
        stack_path: str,
        module: str | None = None,
        abs_path: str | None = None,
        platform: str | None = None,
        project: Project | None = None,
        user: SentryUser | None = None,
    ) -> Response:
        self.login_as(user=user or self.user)
        if not project:
            project = self.project
        assert project is not None

        url = reverse(
            "sentry-api-0-project-repo-path-parsing",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        return self.client.post(
            url,
            data={
                "sourceUrl": source_url,
                "stackPath": stack_path,
                "module": module,
                "absPath": abs_path,
                "platform": platform,
            },
        )


class PathMappingSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.oi = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="github",
            name="getsentry",
            external_id="1234",
            metadata={"domain_name": "github.com/getsentry"},
        )
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/sentry",
        )

    def test_basic(self) -> None:
        serializer = PathMappingSerializer(
            context={"organization_id": self.organization.id},
            data={
                "source_url": "https://github.com/getsentry/sentry/blob/random.py",
                "stack_path": "/random.py",
            },
        )

        assert serializer.is_valid()
        assert serializer.data["stack_path"] == "/random.py"
        assert serializer.data["source_url"] == "https://github.com/getsentry/sentry/blob/random.py"

    def test_window_stack_path(self) -> None:
        serializer = PathMappingSerializer(
            context={"organization_id": self.organization.id},
            data={
                "source_url": "https://github.com/getsentry/sentry/blob/duck.py",
                "stack_path": "C:\\duck.py",
            },
        )
        assert serializer.is_valid()
        assert serializer.data["stack_path"] == "C:\\duck.py"
        assert serializer.data["source_url"] == "https://github.com/getsentry/sentry/blob/duck.py"

    def test_wrong_file(self) -> None:
        serializer = PathMappingSerializer(
            context={"organization_id": self.organization.id},
            data={
                "source_url": "https://github.com/getsentry/sentry/blob/random.py",
                "stack_path": "/badfile.py",
            },
        )

        assert not serializer.is_valid()
        assert (
            serializer.errors["sourceUrl"][0]
            == "Source code URL points to a different file than the stack trace"
        )

    def test_no_integration(self) -> None:
        new_org = self.create_organization()
        serializer = PathMappingSerializer(
            context={"organization_id": new_org.id},
            data={
                "source_url": "https://github.com/getsentry/sentry/blob/capybaras_and_chameleons.py",
                "stack_path": "/capybaras_and_chameleons.py",
            },
        )

        assert not serializer.is_valid()
        assert serializer.errors["sourceUrl"][0] == "Could not find integration"

    def test_no_repo(self) -> None:
        new_org = self.create_organization()
        self.integration, self.oi = self.create_provider_integration_for(
            new_org,
            self.user,
            provider="github",
            name="getsentry",
            external_id="1235",
            metadata={"domain_name": "github.com/getsentry"},
        )
        serializer = PathMappingSerializer(
            context={"organization_id": new_org.id},
            data={
                "source_url": "https://github.com/getsentry/sentry/blob/capybaras_and_chameleons.py",
                "stack_path": "/capybaras_and_chameleons.py",
            },
        )
        assert not serializer.is_valid()
        assert serializer.errors["sourceUrl"][0] == "Could not find repo"


class ProjectStacktraceLinkGithubTest(BaseStacktraceLinkTest):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration, self.oi = self.create_provider_integration_for(
                self.org,
                self.user,
                provider="github",
                name="getsentry",
                external_id="1234",
                metadata={"domain_name": "github.com/getsentry"},
            )

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/sentry",
        )

        self.create_repo(
            project=self.project,
            name="getsentry/getsentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/getsentry",
        )

    def test_bad_source_url(self) -> None:
        source_url = "github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {"sourceUrl": ["Enter a valid URL."]}

    def test_wrong_file(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_releases.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {
            "sourceUrl": ["Source code URL points to a different file than the stack trace"]
        }

    def test_no_integration(self) -> None:
        # create the integration but don't install it
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_provider_integration(
                provider="github",
                name="steve",
                external_id="345",
                metadata={"domain_name": "github.com/steve"},
            )
        source_url = "https://github.com/steve/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {"sourceUrl": ["Could not find integration"]}

    def test_no_repo(self) -> None:
        source_url = "https://github.com/getsentry/snuba/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {"sourceUrl": ["Could not find repo"]}

    def test_single_file_path(self) -> None:
        source_url = (
            "https://github.com/getsentry/sentry/blob/master/src/project_stacktrace_link.py"
        )
        stack_path = "project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "",
            "sourceRoot": "src/",
            "defaultBranch": "master",
        }

    def test_basic(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content

        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "sentry/",
            "sourceRoot": "src/sentry/",
            "defaultBranch": "master",
        }

    def test_java_path(self) -> None:
        src_file = "src/com/example/foo/Bar.kt"
        source_url = f"https://github.com/getsentry/sentry/blob/master/{src_file}"
        filename = "Bar.kt"  # The filename in Java does not contain the package name
        resp = self.make_post(
            source_url,
            filename,
            module="com.example.foo.Bar",  # The module misses the extension
            abs_path="Bar.kt",  # abs_path includes the extension
            platform="java",
        )
        assert resp.status_code == 200, resp.content

        assert resp.data == {
            "defaultBranch": "master",
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "sourceRoot": "src/com/example/foo/",
            "stackRoot": "com/example/foo/",
        }

    def test_short_path(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/main/project_stacktrace_link.py"
        stack_path = "sentry/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "sentry/",
            "sourceRoot": "",
            "defaultBranch": "main",
        }

    def test_long_root(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "stuff/hey/here/sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "stuff/hey/here/",
            "sourceRoot": "src/",
            "defaultBranch": "master",
        }

    def test_member_can_access(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "stuff/hey/here/sentry/api/endpoints/project_stacktrace_link.py"
        member = self.create_user("hernando@life.com")
        self.create_member(user=member, organization=self.org, role="member")
        resp = self.make_post(source_url, stack_path, user=member)
        assert resp.status_code == 200, resp.content

    def test_backslash_short_path(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/main/project_stacktrace_link.py"
        stack_path = "C:\\sentry\\project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "C:\\sentry\\",
            "sourceRoot": "",
            "defaultBranch": "main",
        }

    def test_backslash_long_path(self) -> None:
        source_url = "https://github.com/getsentry/sentry/blob/main/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "C:\\potatos\\and\\prs\\sentry\\api\\endpoints\\project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "C:\\potatos\\and\\prs\\",
            "sourceRoot": "src/",
            "defaultBranch": "main",
        }

    def test_trailing_slash_repo_url_short_path(self) -> None:
        # Ensure branch parsing is correct when repo.url has a trailing slash
        self.repo.update(url=f"{self.repo.url}/")

        source_url = "https://github.com/getsentry/sentry/blob/main/project_stacktrace_link.py"
        stack_path = "sentry/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "sentry/",
            "sourceRoot": "",
            "defaultBranch": "main",
        }

    def test_second_repo_trailing_slash_default_branch_main(self) -> None:
        # Ensure defaultBranch is parsed as 'main' for another repo with trailing slash in repo.url
        second_repo = self.create_repo(
            project=self.project,
            name="getsentry/example",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/example/",
        )

        source_url = "https://github.com/getsentry/example/blob/main/src/pkg/main.py"
        stack_path = "/opt/app/src/pkg/main.py"
        resp = self.make_post(
            source_url,
            stack_path,
            module="pkg.main",
            abs_path="/opt/app/src/pkg/main.py",
            platform="python",
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["provider"] == "github"
        assert resp.data["repositoryId"] == second_repo.id
        assert resp.data["defaultBranch"] == "main"


class ProjectStacktraceLinkGitlabTest(BaseStacktraceLinkTest):
    def setUp(self) -> None:
        super().setUp()

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider="gitlab",
                name="getsentry",
                external_id="1234",
                metadata={"domain_name": "gitlab.com/getsentry"},
            )

            self.oi = self.integration.add_organization(self.org, self.user)

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:gitlab",
            integration_id=self.integration.id,
            url="https://gitlab.com/getsentry/sentry",
        )

    def test_basic(self) -> None:
        source_url = "https://gitlab.com/getsentry/sentry/-/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content

        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "gitlab",
            "stackRoot": "sentry/",
            "sourceRoot": "src/sentry/",
            "defaultBranch": "master",
        }

    def test_skips_null_repo_url(self) -> None:
        self.repo.update(url=None)
        source_url = "https://gitlab.com/getsentry/sentry/-/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content

        assert resp.data == {"sourceUrl": ["Could not find repo"]}
