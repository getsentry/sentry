import base64
from unittest import mock

import pytest
import responses

from sentry.models import Integration, Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils import TestCase

GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://github.com/org/reponame/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class GitHubAppsClientTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def setUp(self, get_jwt):
        integration = Integration.objects.create(
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            integration_id=integration.id,
        )

        self.install = integration.get_installation(organization_id="123")
        self.client = self.install.get_client()

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_save_token(self, get_jwt):

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

        token = self.client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

        # Second get_token doesn't have to make an API call
        token = self.client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_check_file(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        path = "src/sentry/integrations/github/client.py"
        version = "master"
        url = f"https://api.github.com/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        resp = self.client.check_file(self.repo, path, version)
        assert resp.status_code == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_check_no_file(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        path = "src/santry/integrations/github/client.py"
        version = "master"
        url = f"https://api.github.com/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.client.check_file(self.repo, path, version)
        assert responses.calls[1].response.status_code == 404

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        path = "/src/sentry/integrations/github/client.py"
        version = "master"
        url = "https://api.github.com/repos/{}/contents/{}?ref={}".format(
            self.repo.name, path.lstrip("/"), version
        )

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://github.com/Test-Organization/foo/blob/master/src/sentry/integrations/github/client.py"
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_with_pagination(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        url = f"https://api.github.com/repos/{self.repo.name}/assignees?per_page={self.client.page_size}"

        responses.add(
            method=responses.GET,
            url=url,
            json={"text": 200},
            headers={"link": f'<{url}&page=2>; rel="next", <{url}&page=4>; rel="last"'},
        )
        # For simplicity, we're skipping the `first` and `prev` links from the following responses
        responses.add(
            method=responses.GET,
            url=f"{url}&page=2",
            json={"text": 200},
            headers={"link": f'<{url}&page=3>; rel="next", <{url}&page=4>; rel="last"'},
        )
        responses.add(
            method=responses.GET,
            url=f"{url}&page=3",
            json={"text": 200},
            headers={"link": f'<{url}&page=4>; rel="next", <{url}&page=4>; rel="last"'},
        )
        responses.add(
            method=responses.GET,
            url=f"{url}&page=4",
            json={"text": 200},
            # To help understanding, the last page only contains the `first` and `prev` links
            # The code only cares about the `next` value which is not included here
            headers={"link": f'<{url}&page=1>; rel="first", <{url}&page=3>; rel="prev"'},
        )
        self.client.get_with_pagination(f"/repos/{self.repo.name}/assignees")
        assert len(responses.calls) == 5
        assert responses.calls[1].response.status_code == 200

    @mock.patch(
        "sentry.integrations.github.integration.GitHubIntegration.check_file",
        return_value=GITHUB_CODEOWNERS["html_url"],
    )
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_codeowner_file(self, mock_jwt, mock_check_file):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/contents/CODEOWNERS?ref=master",
            json={"content": base64.b64encode(GITHUB_CODEOWNERS["raw"].encode()).decode("ascii")},
        )
        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )

        assert result == GITHUB_CODEOWNERS

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_blame_for_file(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        path = "src/sentry/integrations/github/client.py"
        ref = "master"
        query = f"""query {{
            repository(name: "foo", owner: "Test-Organization") {{
                ref(qualifiedName: "{ref}") {{
                    target {{
                        ... on Commit {{
                            blame(path: "{path}") {{
                                ranges {{
                                        commit {{
                                            oid
                                            author {{
                                                name
                                                email
                                            }}
                                            message
                                            committedDate
                                        }}
                                    startingLine
                                    endingLine
                                    age
                                }}
                            }}
                        }}
                    }}
                }}
            }}
        }}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={"query": query},
            content_type="application/json",
        )
        resp = self.client.get_blame_for_file(self.repo, path, ref, 1)
        assert (
            responses.calls[1].request.body
            == b'{"query": "query {\\n            repository(name: \\"foo\\", owner: \\"Test-Organization\\") {\\n                ref(qualifiedName: \\"master\\") {\\n                    target {\\n                        ... on Commit {\\n                            blame(path: \\"src/sentry/integrations/github/client.py\\") {\\n                                ranges {\\n                                        commit {\\n                                            oid\\n                                            author {\\n                                                name\\n                                                email\\n                                            }\\n                                            message\\n                                            committedDate\\n                                        }\\n                                    startingLine\\n                                    endingLine\\n                                    age\\n                                }\\n                            }\\n                        }\\n                    }\\n                }\\n            }\\n        }"}'
        )

        assert resp == []
