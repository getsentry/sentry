from unittest import mock

from scm.errors import (
    ProviderNotFound,
    RateLimitExceeded,
    RepositoryInactive,
    ResourceNotFound,
    SCMError,
)

from sentry.testutils.cases import APITestCase

_MAKE_SCM = "sentry.integrations.api.endpoints.organization_pull_request_files.make_scm"


def _page(files, next_cursor=""):
    return {"data": files, "meta": {"next_cursor": next_cursor}}


class _FakeScm:
    def __init__(self, pages=None, error=None):
        self._pages = list(pages or [])
        self._error = error
        self.calls: list[str] = []

    def get_pull_request_files(self, pull_request_id, pagination=None, request_options=None):
        self.calls.append(pull_request_id)
        if self._error is not None:
            raise self._error
        return self._pages.pop(0)


class OrganizationPullRequestFilesTest(APITestCase):
    endpoint = "sentry-api-0-organization-pull-request-files"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _set_scm(self, mock_make_scm, pages=None, error=None):
        scm = _FakeScm(pages=pages, error=error)
        mock_make_scm.return_value = scm
        return scm

    @mock.patch(_MAKE_SCM)
    def test_returns_files_with_patches(self, mock_make_scm):
        scm = self._set_scm(
            mock_make_scm,
            pages=[_page([{"filename": "src/foo.py", "patch": "@@ -1 +1 @@\n-old\n+new"}])],
        )
        response = self.get_success_response(self.organization.slug, self.pull_request.id)
        assert response.data == {
            "files": [{"path": "src/foo.py", "patch": "@@ -1 +1 @@\n-old\n+new"}]
        }
        mock_make_scm.assert_called_once_with(
            self.organization.id, self.repo.id, referrer="pull-request-files"
        )
        assert scm.calls[0] == "42"

    @mock.patch(_MAKE_SCM)
    def test_binary_file_patch_is_null(self, mock_make_scm):
        self._set_scm(mock_make_scm, pages=[_page([{"filename": "image.png", "patch": None}])])
        response = self.get_success_response(self.organization.slug, self.pull_request.id)
        assert response.data == {"files": [{"path": "image.png", "patch": None}]}

    @mock.patch(_MAKE_SCM)
    def test_paginates_across_pages(self, mock_make_scm):
        self._set_scm(
            mock_make_scm,
            pages=[
                _page([{"filename": "a.py", "patch": "@@a"}], next_cursor="2"),
                _page([{"filename": "b.py", "patch": "@@b"}]),
            ],
        )
        response = self.get_success_response(self.organization.slug, self.pull_request.id)
        assert [f["path"] for f in response.data["files"]] == ["a.py", "b.py"]

    def test_pull_request_in_other_org_returns_404(self):
        other_org = self.create_organization(owner=self.create_user())
        other_repo = self.create_repo(
            project=self.create_project(organization=other_org),
            name="other/repo",
            provider="integrations:github",
            integration_id=456,
        )
        other_pull_request = self.create_pull_request(
            repository_id=other_repo.id,
            organization_id=other_org.id,
            key="7",
        )
        self.get_error_response(self.organization.slug, other_pull_request.id, status_code=404)

    def test_nonexistent_pull_request_returns_404(self):
        self.get_error_response(self.organization.slug, 999999, status_code=404)

    def test_non_numeric_pull_request_id_returns_404(self):
        self.get_error_response(self.organization.slug, "not-a-number", status_code=404)

    @mock.patch(_MAKE_SCM)
    def test_inactive_repository_returns_404(self, mock_make_scm):
        mock_make_scm.side_effect = RepositoryInactive()
        self.get_error_response(self.organization.slug, self.pull_request.id, status_code=404)

    @mock.patch(_MAKE_SCM)
    def test_unsupported_provider_returns_empty(self, mock_make_scm):
        mock_make_scm.side_effect = ProviderNotFound()
        response = self.get_success_response(self.organization.slug, self.pull_request.id)
        assert response.data == {"files": []}

    @mock.patch(_MAKE_SCM)
    def test_provider_without_files_capability_returns_empty(self, mock_make_scm):
        mock_make_scm.return_value = object()
        response = self.get_success_response(self.organization.slug, self.pull_request.id)
        assert response.data == {"files": []}

    @mock.patch(_MAKE_SCM)
    def test_provider_error_returns_502(self, mock_make_scm):
        self._set_scm(mock_make_scm, error=SCMError("boom"))
        self.get_error_response(self.organization.slug, self.pull_request.id, status_code=502)

    @mock.patch(_MAKE_SCM)
    def test_pull_request_missing_on_provider_returns_404(self, mock_make_scm):
        self._set_scm(mock_make_scm, error=ResourceNotFound())
        self.get_error_response(self.organization.slug, self.pull_request.id, status_code=404)

    @mock.patch(_MAKE_SCM)
    def test_provider_rate_limited_returns_429(self, mock_make_scm):
        self._set_scm(mock_make_scm, error=RateLimitExceeded())
        self.get_error_response(self.organization.slug, self.pull_request.id, status_code=429)
