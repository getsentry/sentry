from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any
from unittest import mock
from urllib.parse import urlencode

import jwt
import pytest
import responses
from requests import Request

from sentry.integrations.bitbucket.client import BitbucketApiClient
from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.integrations.bitbucket.utils import BitbucketAPIPath
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"

BITBUCKET_CODEOWNERS = {
    "filepath": ".bitbucket/CODEOWNERS",
    "html_url": "https://bitbucket.org/sentryuser/newsdiffs/src/master/.bitbucket/CODEOWNERS",
    "raw": "docs/* @jianyuan @getsentry/ecosystem\n* @jianyuan\n",
}


@control_silo_test
class BitbucketApiClientTest(TestCase, BaseTestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="connection:123",
            provider="bitbucket",
            metadata={
                "public_key": "public-key",
                "base_url": "https://api.bitbucket.org",
                "shared_secret": "a-big-secret",
                "domain_name": "bitbucket.org/test-org",
                "icon": "https://bitbucket.org/account/test-org/avatar/",
                "scopes": ["issue:write", "pullrequest", "webhook", "repository"],
                "uuid": "u-u-i-d",
                "type": "team",
            },
        )
        install = self.integration.get_installation(self.organization.id)
        assert isinstance(install, BitbucketIntegration)
        self.install = install
        self.bitbucket_client: BitbucketApiClient = self.install.get_client()

        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = Repository.objects.create(
                provider="bitbucket",
                name="sentryuser/newsdiffs",
                organization_id=self.organization.id,
                config={"name": "sentryuser/newsdiffs"},
                integration_id=self.integration.id,
            )

    @freeze_time("2023-01-01 01:01:01")
    def test_finalize_request(self):
        method = "GET"
        username = self.integration.metadata["uuid"]
        path = BitbucketAPIPath.repositories.format(username=username)
        params = {"q": 'name~"fuzzy-repo-name"'}
        prepared_request = Request(
            method=method, url=f"{self.bitbucket_client.base_url}{path}", params=params
        ).prepare()
        self.bitbucket_client.finalize_request(prepared_request=prepared_request)
        raw_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmJpdGJ1Y2tldCIsImlhdCI6MTY3MjUzNDg2MSwiZXhwIjoxNjcyNTM1MTYxLCJxc2giOiJiMGQxYzk0NjRhZGZhOWZlYzg5ZjRmMGM3YjY5MzAxMmZhYTdmN2EyMDRkNzU5NjJkY2FjZGRhM2M2MjY4NzViIiwic3ViIjoiY29ubmVjdGlvbjoxMjMifQ.E3xU7-AgZ2sM-s_yoGAiOGmFZQg63IJJ76YrDwk2qBw"
        assert prepared_request.headers["Authorization"] == f"JWT {raw_jwt}"

        decoded_jwt = jwt.decode(
            raw_jwt,
            key=self.integration.metadata["shared_secret"],
            algorithms=["HS256"],
        )
        assert decoded_jwt == {
            "exp": 1672535161,
            "iat": 1672534861,
            "iss": "testserver.bitbucket",
            "qsh": get_query_hash(uri=path, method=method, query_params=params),
            "sub": self.integration.external_id,
        }

    @responses.activate
    def test_check_file(self):
        path = "src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        resp = self.bitbucket_client.check_file(self.repo, path, version)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self):
        path = "src/santry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.bitbucket_client.check_file(self.repo, path, version)

    @responses.activate
    def test_get_stacktrace_link(self):
        path = "/src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path.lstrip('/')}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://bitbucket.org/sentryuser/newsdiffs/src/master/src/sentry/integrations/bitbucket/client.py"
        )

    @responses.activate
    def test_get_codeowner_file(self):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        path = ".bitbucket/CODEOWNERS"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.config.repository.name}/src/{self.config.default_branch}/{path}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )
        responses.add(
            method=responses.GET,
            url=url,
            content_type="text/plain",
            body=BITBUCKET_CODEOWNERS["raw"],
        )

        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )
        assert result == BITBUCKET_CODEOWNERS


@control_silo_test
class BitbucketBlameForFilesTest(BitbucketApiClientTest):
    def setUp(self):
        super().setUp()

        """
        The commit history is as follows, from newest to oldest:
        ---
        1. This is
        2. an updated
        3. multiline example
        4. with
        5. some lines
        6. in it
        7.
        8. (The end)
        ---
        1. This is
        2. an updated
        3. multiline example
        4. with
        5. some lines
        6. in it
        7.
        8. Another chunk
        9. of text
        10.
        11. (The end)
        ---
        1. This is
        2. a multiline
        3. file with
        4. some lines
        5. in it
        6.
        7. Another chunk
        8. of text
        9. here
        10.
        11. (The end)
        """

        self.third_commit = CommitInfo(
            commitId="third",
            commitMessage="third commit message",
            committedDate=datetime(2025, 1, 3, 0, 0, 0, tzinfo=timezone.utc),
            commitAuthorEmail="third@user.com",
            commitAuthorName="Third User",
        )
        self.second_commit = CommitInfo(
            commitId="second",
            commitMessage="second commit message",
            committedDate=datetime(2025, 1, 2, 0, 0, 0, tzinfo=timezone.utc),
            commitAuthorEmail="second@user.com",
            commitAuthorName="Second User",
        )
        self.first_commit = CommitInfo(
            commitId="first",
            commitMessage="first commit message",
            committedDate=datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
            commitAuthorEmail="first@user.com",
            commitAuthorName="First User",
        )

        self.file_diffs: list[tuple[CommitInfo, str]] = [
            (
                self.third_commit,
                """diff --git a/example.txt b/example.txt
index 6ce42d3..02ac986 100644
--- a/example.txt
+++ b/example.txt
@@ -5,7 +5,4 @@ with
 some lines
 in it

-Another chunk
-of text
-
 (The end)
""",
            ),
            (
                self.second_commit,
                """diff --git a/example.txt b/example.txt
index 2b313e3..6ce42d3 100644
--- a/example.txt
+++ b/example.txt
@@ -1,11 +1,11 @@
 This is
-a multiline
-file with
+an updated
+multiline example
+with
 some lines
 in it

 Another chunk
 of text
-here

 (The end)
""",
            ),
            (
                self.first_commit,
                """diff --git a/example.txt b/example.txt
new file mode 100644
index 0000000..2b313e3
--- /dev/null
+++ b/example.txt
@@ -0,0 +1,11 @@
+This is
+a multiline
+file with
+some lines
+in it
+
+Another chunk
+of text
+here
+
+(The end)
""",
            ),
        ]

        self.file = SourceLineInfo(
            path="example.txt",
            lineno=mock.ANY,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )

    def set_up_success_responses(self):
        responses.add(
            method=responses.GET,
            url=self.make_filehistory_url(file=self.file, page=None),
            json=self.make_filehistory_response(
                file=self.file, diffs=[self.file_diffs[0], self.file_diffs[1]], next_page=1
            ),
            status=200,
        )
        responses.add(
            method=responses.GET,
            url=self.make_filehistory_url(file=self.file, page=1),
            json=self.make_filehistory_response(
                file=self.file, diffs=[self.file_diffs[2]], next_page=None
            ),
            status=200,
        )
        for commit, diff in self.file_diffs:
            responses.add(
                method=responses.GET,
                url=self.make_diff_url(file=self.file, hash=commit.commitId),
                body=diff,
                content_type="text/plain",
                status=200,
            )

    def make_filehistory_url(self, file: SourceLineInfo, page: int | None = None) -> str:
        params = urlencode(
            {
                "fields": ",".join(
                    [
                        "next",
                        "values.commit.author.*",
                        "values.commit.hash",
                        "values.commit.date",
                        "values.commit.message",
                    ],
                ),
                **({"page": page} if page is not None else {}),
            }
        )
        return f"https://api.bitbucket.org/2.0/repositories/{self.repo.config['name']}/filehistory/master/{file.path}?{params}"

    def make_filehistory_response(
        self,
        file: SourceLineInfo,
        diffs: list[tuple[CommitInfo, str]],
        next_page: int | None = None,
    ) -> dict[str, Any]:
        return {
            "values": [
                {
                    "commit": {
                        "author": {
                            "raw": f"{commit.commitAuthorName} <{commit.commitAuthorEmail}>"
                        },
                        "date": commit.committedDate.isoformat(),
                        "hash": commit.commitId,
                        "message": commit.commitMessage,
                    },
                }
                for commit, _diff in diffs
            ],
            **(
                {"next": self.make_filehistory_url(file=file, page=next_page)}
                if next_page is not None
                else {}
            ),
        }

    def make_diff_url(self, file: SourceLineInfo, hash: str) -> str:
        params = urlencode({"path": file.path})
        return f"https://api.bitbucket.org/2.0/repositories/{self.repo.config['name']}/diff/{hash}?{params}"

    @freeze_time("2025-01-01 01:01:01")
    @responses.activate
    def test_success_line_not_changed(self):
        # Line 1 was introduced in the first commit and has not been changed since.
        file = SourceLineInfo(
            path="example.txt",
            lineno=1,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )
        blame = FileBlameInfo(
            **asdict(file),
            commit=self.first_commit,
        )

        self.set_up_success_responses()
        resp = self.bitbucket_client.get_blame_for_files(files=[file], extra={})

        assert resp == [blame]

    @freeze_time("2025-01-01 01:01:01")
    @responses.activate
    def test_success_line_changed_multiple_times(self):
        # Line 8 was introduced in the first commit. Note that the line has been updated in subsequent commits
        # so the blame should be the first commit.
        file = SourceLineInfo(
            path="example.txt",
            lineno=8,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )
        blame = FileBlameInfo(
            **asdict(file),
            commit=self.first_commit,
        )

        self.set_up_success_responses()
        resp = self.bitbucket_client.get_blame_for_files(files=[file], extra={})

        assert resp == [blame]

    @freeze_time("2025-01-01 01:01:01")
    @responses.activate
    def test_success_line_changed_once(self):
        # Line 2 was changed in the second commit.
        file = SourceLineInfo(
            path="example.txt",
            lineno=2,
            ref="master",
            repo=self.repo,
            code_mapping=mock.ANY,
        )
        blame = FileBlameInfo(
            **asdict(file),
            commit=self.second_commit,
        )

        self.set_up_success_responses()
        resp = self.bitbucket_client.get_blame_for_files(files=[file], extra={})

        assert resp == [blame]

    @mock.patch(
        "sentry.integrations.bitbucket.blame.logger.warning",
    )
    @responses.activate
    def test_failure_404(self, mock_logger_warning):
        responses.add(
            responses.GET,
            self.make_filehistory_url(file=self.file, page=None),
            status=404,
            body="No file found",
        )
        resp = self.bitbucket_client.get_blame_for_files(files=[self.file], extra={})

        assert resp == []
        mock_logger_warning.assert_any_call(
            "blame_file.filehistory.api_error",
            extra={
                "provider": "bitbucket",
                "org_integration_id": self.bitbucket_client.integration_id,
                "code": 404,
                "error_message": "No file found",
                "repo_name": self.repo.name,
                "file_path": self.file.path,
                "branch_name": self.file.ref,
                "file_lineno": self.file.lineno,
            },
        )
        mock_logger_warning.assert_any_call(
            "fetch_file_blames.no_blame_info",
            extra={
                "provider": "bitbucket",
                "org_integration_id": self.bitbucket_client.integration_id,
                "file_path": self.file.path,
                "file_lineno": self.file.lineno,
            },
        )
