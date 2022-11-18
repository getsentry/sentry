from django.urls import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


class BaseStacktraceLinkTest(APITestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user, name="blap")
        self.project = self.create_project(
            name="foo", organization=self.org, teams=[self.create_team(organization=self.org)]
        )

    def make_post(self, source_url, stack_path, project=None, user=None):
        self.login_as(user=user or self.user)
        if not project:
            project = self.project

        url = reverse(
            "sentry-api-0-project-repo-path-parsing",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        return self.client.post(url, data={"sourceUrl": source_url, "stackPath": stack_path})


@region_silo_test
class ProjectStacktraceLinkGithubTest(BaseStacktraceLinkTest):
    def setUp(self):
        super().setUp()
        self.integration = Integration.objects.create(
            provider="github",
            name="getsentry",
            external_id="1234",
            metadata={"domain_name": "github.com/getsentry"},
        )

        self.oi = self.integration.add_organization(self.org, self.user)

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

    def test_bad_source_url(self):
        source_url = "github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {"sourceUrl": ["Enter a valid URL."]}

    def test_wrong_file(self):
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_releases.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {
            "sourceUrl": ["Source code URL points to a different file than the stack trace"]
        }

    def test_no_integration(self):
        # create the integration but don't install it
        Integration.objects.create(
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

    def test_no_repo(self):
        source_url = "https://github.com/getsentry/snuba/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content
        assert resp.data == {"sourceUrl": ["Could not find repo"]}

    def test_basic(self):
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
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

    def test_short_path(self):
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

    def test_long_root(self):
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "stuff/hey/here/sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content
        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "github",
            "stackRoot": "stuff/hey/here",
            "sourceRoot": "src",
            "defaultBranch": "master",
        }

    def test_member_can_access(self):
        source_url = "https://github.com/getsentry/sentry/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "stuff/hey/here/sentry/api/endpoints/project_stacktrace_link.py"
        member = self.create_user("hernando@life.com")
        self.create_member(user=member, organization=self.org, role="member")
        resp = self.make_post(source_url, stack_path, user=member)
        assert resp.status_code == 200, resp.content


@region_silo_test
class ProjectStacktraceLinkGitlabTest(BaseStacktraceLinkTest):
    def setUp(self):
        super().setUp()

        self.integration = Integration.objects.create(
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

    def test_basic(self):
        source_url = "https://gitlab.com/getsentry/sentry/-/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 200, resp.content

        assert resp.data == {
            "integrationId": self.integration.id,
            "repositoryId": self.repo.id,
            "provider": "gitlab",
            "stackRoot": "",
            "sourceRoot": "src/",
            "defaultBranch": "master",
        }

    def test_skips_null_repo_url(self):
        self.repo.update(url=None)
        source_url = "https://gitlab.com/getsentry/sentry/-/blob/master/src/sentry/api/endpoints/project_stacktrace_link.py"
        stack_path = "sentry/api/endpoints/project_stacktrace_link.py"
        resp = self.make_post(source_url, stack_path)
        assert resp.status_code == 400, resp.content

        assert resp.data == {"sourceUrl": ["Could not find repo"]}
