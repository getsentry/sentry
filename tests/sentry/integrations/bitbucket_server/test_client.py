from copy import deepcopy
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any
from unittest import mock

import orjson
import pytest
import responses
from django.test import override_settings
from requests import Request

from fixtures.bitbucket_server import REPO
from sentry.integrations.bitbucket_server.integration import BitbucketServerIntegration
from sentry.integrations.bitbucket_server.utils import BitbucketServerAPIPath
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from tests.sentry.integrations.jira_server import EXAMPLE_PRIVATE_KEY

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"

BITBUCKET_SERVER_CODEOWNERS = {
    "filepath": ".bitbucket/CODEOWNERS",
    "html_url": "https://bitbucket.example.com/projects/PROJ/repos/repository-name/browse/.bitbucket/CODEOWNERS?at=master",
    "raw": "docs/* @jianyuan @getsentry/ecosystem\n* @jianyuan\n",
}


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
@control_silo_test
class BitbucketServerClientTest(TestCase, BaseTestCase):
    def setUp(self):
        self.integration = self.create_provider_integration(
            provider="bitbucket_server",
            name="Bitbucket Server",
            metadata={"base_url": "https://bitbucket.example.com", "verify_ssl": True},
        )

        idp = self.create_identity_provider(integration=self.integration)
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="bitbucket:123",
            data={
                "consumer_key": "cnsmr-key",
                "private_key": EXAMPLE_PRIVATE_KEY,
                "access_token": "acs-tkn",
                "access_token_secret": "acs-tkn-scrt",
            },
        )
        self.integration.add_organization(
            self.organization, self.user, default_auth_id=self.identity.id
        )
        self.install = get_installation_of_type(
            BitbucketServerIntegration, self.integration, self.organization.id
        )
        self.bb_server_client = self.install.get_client()

        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = Repository.objects.create(
                provider=self.integration.provider,
                name="PROJ/repository-name",
                organization_id=self.organization.id,
                config={
                    "name": "TEST/repository-name",
                    "project": "PROJ",
                    "repo": "repository-name",
                },
                integration_id=self.integration.id,
            )

    def test_authorize_request(self):
        method = "GET"
        request = Request(
            method=method,
            url=f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.repositories}",
        ).prepare()

        self.bb_server_client.authorize_request(prepared_request=request)
        consumer_key = self.identity.data["consumer_key"]
        access_token = self.identity.data["access_token"]
        header_components = [
            'oauth_signature_method="RSA-SHA1"',
            f'oauth_consumer_key="{consumer_key}"',
            f'oauth_token="{access_token}"',
            "oauth_signature",
        ]
        for hc in header_components:
            assert hc in request.headers["Authorization"]

    @responses.activate
    def test_get_repo_authentication(self):
        responses.add(
            responses.GET,
            f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.repository.format(project='laurynsentry', repo='helloworld')}",
            body=orjson.dumps(REPO),
        )

        res = self.bb_server_client.get_repo("laurynsentry", "helloworld")

        assert isinstance(res, dict)
        assert res["slug"] == "helloworld"

        assert len(responses.calls) == 1
        assert "oauth_consumer_key" in responses.calls[0].request.headers["Authorization"]

    @responses.activate
    def test_check_file(self):
        path = "src/sentry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.HEAD,
            url=url,
            status=200,
        )

        resp = self.bb_server_client.check_file(self.repo, path, version)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self):
        path = "src/santry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.HEAD,
            url=url,
            status=404,
        )

        with pytest.raises(ApiError):
            self.bb_server_client.check_file(self.repo, path, version)

    @responses.activate
    def test_get_file(self):
        path = "src/sentry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_raw(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.GET,
            url=url,
            body="Hello, world!",
            status=200,
        )

        resp = self.bb_server_client.get_file(self.repo, path, version)
        assert resp == "Hello, world!"

    @responses.activate
    def test_get_stacktrace_link(self):
        path = "src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            method=responses.HEAD,
            url=url,
            status=200,
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://bitbucket.example.com/projects/PROJ/repos/repository-name/browse/src/sentry/integrations/bitbucket/client.py?at=master"
        )

    @responses.activate
    def test_get_codeowner_file(self):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        path = ".bitbucket/CODEOWNERS"
        source_url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=self.config.default_branch,
        )
        raw_url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_raw(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=self.config.default_branch,
        )

        responses.add(
            method=responses.HEAD,
            url=source_url,
            status=200,
        )
        responses.add(
            method=responses.GET,
            url=raw_url,
            content_type="text/plain",
            body=BITBUCKET_SERVER_CODEOWNERS["raw"],
        )

        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )
        assert result == BITBUCKET_SERVER_CODEOWNERS


@control_silo_test
class BitbucketServerClientBlameForFilesTest(BitbucketServerClientTest):
    def setUp(self):
        super().setUp()

        self.file_1 = SourceLineInfo(
            path="example_1.txt",
            lineno=1,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )
        self.file_2 = SourceLineInfo(
            path="example_2.txt",
            lineno=3,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )
        self.file_3 = SourceLineInfo(
            path="example_3.txt",
            lineno=5,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )

        self.blame_1 = FileBlameInfo(
            **asdict(self.file_1),
            commit=CommitInfo(
                commitId="first",
                commitMessage="first commit message",
                committedDate=datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="first@user.com",
                commitAuthorName="First User",
            ),
        )
        self.blame_2 = FileBlameInfo(
            **asdict(self.file_2),
            commit=CommitInfo(
                commitId="second",
                commitMessage="second commit message",
                committedDate=datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="second@user.com",
                commitAuthorName="Second User",
            ),
        )
        self.blame_3 = FileBlameInfo(
            **asdict(self.file_3),
            commit=CommitInfo(
                commitId="third",
                commitMessage="third commit message",
                committedDate=datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="third@user.com",
                commitAuthorName="Third User",
            ),
        )

    def set_up_success_blame_responses(self):
        responses.add(
            responses.GET,
            url=self.make_blame_url(self.file_1),
            json=self.make_blame_response(path="example_1.txt"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_url(self.file_2),
            json=self.make_blame_response(path="example_2.txt"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_url(self.file_3),
            json=self.make_blame_response(path="example_3.txt"),
            status=200,
        )

    def set_up_success_commit_responses(self):
        responses.add(
            responses.GET,
            url=self.make_commit_url(self.file_1, commit="first"),
            json=self.make_commit_response(message="first commit message"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_commit_url(self.file_2, commit="second"),
            json=self.make_commit_response(message="second commit message"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_commit_url(self.file_3, commit="third"),
            json=self.make_commit_response(message="third commit message"),
            status=200,
        )

    def make_blame_url(self, file: SourceLineInfo) -> str:
        return f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.get_browse(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=file.path,
            sha=file.ref,
            blame=True,
            no_content=True,
        )}"

    def make_blame_response(self, path: str) -> list[dict[str, Any]]:
        return [
            {
                "author": {
                    "name": "First User",
                    "emailAddress": "first@user.com",
                },
                "authorTimestamp": 1735689600000,
                "committer": {
                    "name": "First User",
                    "emailAddress": "first@user.com",
                },
                "committerTimestamp": 1735689600000,
                "commitHash": "first",
                "displayCommitHash": "first",
                "commitId": "first",
                "commitDisplayId": "first",
                "fileName": path,
                "lineNumber": 1,
                "spannedLines": 2,
            },
            {
                "author": {
                    "name": "Second User",
                    "emailAddress": "second@user.com",
                },
                "authorTimestamp": 1735689600000,
                "committer": {
                    "name": "Second User",
                    "emailAddress": "second@user.com",
                },
                "committerTimestamp": 1735689600000,
                "commitHash": "second",
                "displayCommitHash": "second",
                "commitId": "second",
                "commitDisplayId": "second",
                "fileName": path,
                "lineNumber": 3,
                "spannedLines": 2,
            },
            {
                "author": {
                    "name": "Third User",
                    "emailAddress": "third@user.com",
                },
                "authorTimestamp": 1735689600000,
                "committer": {
                    "name": "Third User",
                    "emailAddress": "third@user.com",
                },
                "committerTimestamp": 1735689600000,
                "commitHash": "third",
                "displayCommitHash": "third",
                "commitId": "third",
                "commitDisplayId": "third",
                "fileName": path,
                "lineNumber": 5,
                "spannedLines": 2,
            },
        ]

    def make_commit_url(self, file: SourceLineInfo, commit: str) -> str:
        return f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.repository_commit.format(
            project=file.repo.config["project"],
            repo=file.repo.config["repo"],
            commit=commit,
        )}"

    def make_commit_response(self, message: str) -> dict:
        return {
            "message": message,
        }

    @responses.activate
    def test_success_single_file(self):
        self.set_up_success_blame_responses()
        self.set_up_success_commit_responses()

        resp = self.bb_server_client.get_blame_for_files(files=[self.file_1], extra={})

        assert resp == [self.blame_1]

    @responses.activate
    def test_success_multiple_files(self):
        self.set_up_success_blame_responses()
        self.set_up_success_commit_responses()

        resp = self.bb_server_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )

        assert resp == [self.blame_1, self.blame_2, self.blame_3]

    @mock.patch(
        "sentry.integrations.bitbucket_server.blame.logger.warning",
    )
    @responses.activate
    def test_failure_blame_404(self, mock_logger_warning):
        responses.add(
            responses.GET, self.make_blame_url(self.file_1), status=404, body="No file found"
        )

        resp = self.bb_server_client.get_blame_for_files(files=[self.file_1], extra={})

        assert resp == []
        mock_logger_warning.assert_any_call(
            "blame_file.browse.api_error",
            extra={
                "provider": "bitbucket_server",
                "org_integration_id": self.bb_server_client.integration_id,
                "code": 404,
                "error_message": "No file found",
                "repo_name": self.repo.name,
                "file_path": self.file_1.path,
                "branch_name": self.file_1.ref,
                "file_lineno": self.file_1.lineno,
            },
        )
        mock_logger_warning.assert_any_call(
            "fetch_file_blames.no_blame",
            extra={
                "provider": "bitbucket_server",
                "org_integration_id": self.bb_server_client.integration_id,
                "repo_name": self.repo.name,
                "file_path": self.file_1.path,
                "branch_name": self.file_1.ref,
                "file_lineno": self.file_1.lineno,
            },
        )

    @mock.patch(
        "sentry.integrations.bitbucket_server.blame.logger.warning",
    )
    @responses.activate
    def test_success_commit_404(self, mock_logger_warning):
        self.set_up_success_blame_responses()
        responses.add(
            responses.GET,
            self.make_commit_url(self.file_1, commit="first"),
            status=404,
            body="No file found",
        )

        resp = self.bb_server_client.get_blame_for_files(files=[self.file_1], extra={})

        blame = deepcopy(self.blame_1)
        blame.commit.commitMessage = None
        assert resp == [blame]
        mock_logger_warning.assert_any_call(
            "blame_file.commit.api_error",
            extra={
                "provider": "bitbucket_server",
                "org_integration_id": self.bb_server_client.integration_id,
                "code": 404,
                "error_message": "No file found",
                "commit_id": "first",
                "repo_name": self.repo.name,
                "file_path": self.file_1.path,
                "branch_name": self.file_1.ref,
                "file_lineno": self.file_1.lineno,
            },
        )
