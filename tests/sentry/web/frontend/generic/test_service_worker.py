from unittest import mock

from django.http import HttpResponse
from django.test.utils import override_settings

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.constants import NO_CACHE
from sentry.web.frontend import generic

CDN = "https://cdn.example.com/_static/dist/"
SHA = "abc123def456abc123def456abc123def456abcd"


def _cdn_response(
    content: bytes = b"// service worker bundle", status_code: int = 200
) -> mock.Mock:
    response = mock.Mock()
    response.content = content
    response.status_code = status_code
    response.raise_for_status = mock.Mock()
    return response


def _etag_with_quotes(sha: str) -> str:
    return f'"{sha}"'


@control_silo_test
@override_settings(STATIC_FRONTEND_APP_URL=CDN, DEBUG=False)
class ServiceWorkerProxyTest(TestCase):
    url = "/service-worker.js"

    def setUp(self) -> None:
        super().setUp()
        # The proxied bundle is stashed in a module-level global; reset it so
        # tests don't leak cached results into one another.
        generic._worker_bundle_cache = None

    def tearDown(self) -> None:
        generic._worker_bundle_cache = None
        super().tearDown()

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_proxies_from_cdn_with_etag(self, mock_urlopen: mock.Mock, _sha: mock.Mock) -> None:
        mock_urlopen.return_value = _cdn_response()

        response = self.client.get(self.url)

        assert response.status_code == 200, response
        assert response.content == b"// service worker bundle"
        assert response["Content-Type"] == "text/javascript"
        assert response["ETag"] == _etag_with_quotes(SHA)
        assert response["Service-Worker-Allowed"] == "/"
        assert response["Cache-Control"] == NO_CACHE
        assert response["X-Content-Type-Options"] == "nosniff"

        # Fetched from the service worker entrypoint, exactly once.
        assert mock_urlopen.call_count == 1
        fetched_url = mock_urlopen.call_args.args[0]
        assert fetched_url.endswith("entrypoints/service-worker.js")

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_if_none_match_match_returns_304_without_fetching(
        self, mock_urlopen: mock.Mock, _sha: mock.Mock
    ) -> None:
        mock_urlopen.return_value = _cdn_response()

        response = self.client.get(self.url, HTTP_IF_NONE_MATCH=SHA)

        assert response.status_code == 304, response
        assert response.content == b""
        # The matching ETag short-circuits before any CDN fetch.
        assert mock_urlopen.call_count == 0

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_if_none_match_mismatch_serves_current_version(
        self, mock_urlopen: mock.Mock, _sha: mock.Mock
    ) -> None:
        mock_urlopen.return_value = _cdn_response()

        response = self.client.get(self.url, HTTP_IF_NONE_MATCH="some-stale-sha")

        assert response.status_code == 200, response
        assert response["ETag"] == _etag_with_quotes(SHA)
        assert mock_urlopen.call_count == 1

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_cached_bundle_skips_cdn_fetch(self, mock_urlopen: mock.Mock, _sha: mock.Mock) -> None:
        mock_urlopen.return_value = _cdn_response()

        first = self.client.get(self.url)
        second = self.client.get(self.url)

        assert first.status_code == 200, first
        assert second.status_code == 200, second
        assert second.content == b"// service worker bundle"
        # Second request takes the quick path: served from the in-memory stash,
        # so the CDN is only hit once across both requests.
        assert mock_urlopen.call_count == 1

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha")
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_cache_refetches_when_commit_sha_changes(
        self, mock_urlopen: mock.Mock, mock_sha: mock.Mock
    ) -> None:
        mock_sha.return_value = SHA
        mock_urlopen.return_value = _cdn_response(b"// old")

        first = self.client.get(self.url)
        assert first.status_code == 200, first
        assert first.content == b"// old"
        assert first["ETag"] == _etag_with_quotes(SHA)

        # A new frontend deploy bumps the SHA -> cache key changes -> refetch.
        new_sha = "ffffffffffffffffffffffffffffffffffffffff"
        mock_sha.return_value = new_sha
        mock_urlopen.return_value = _cdn_response(b"// new")

        second = self.client.get(self.url)
        assert second.status_code == 200, second
        assert second.content == b"// new"
        assert second["ETag"] == _etag_with_quotes(new_sha)
        assert mock_urlopen.call_count == 2

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_cdn_failure_returns_404(self, mock_urlopen: mock.Mock, _sha: mock.Mock) -> None:
        from requests.exceptions import RequestException

        mock_urlopen.side_effect = RequestException("boom")

        response = self.client.get(self.url)

        assert response.status_code == 404, response

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_cdn_redirect_returns_404_without_caching(
        self, mock_urlopen: mock.Mock, _sha: mock.Mock
    ) -> None:
        # A redirect isn't followed (SSRF guard) and doesn't raise, so its empty
        # body must not be cached and served as the worker bundle.
        mock_urlopen.return_value = _cdn_response(b"", status_code=302)

        response = self.client.get(self.url)

        assert response.status_code == 404, response
        assert generic._worker_bundle_cache is None

    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=SHA)
    @mock.patch(
        "sentry.web.frontend.generic.get_frontend_app_asset_url",
        side_effect=KeyError("service-worker.js"),
    )
    @mock.patch("sentry.web.frontend.generic.safe_urlopen")
    def test_missing_manifest_entrypoint_returns_404(
        self, mock_urlopen: mock.Mock, _url: mock.Mock, _sha: mock.Mock
    ) -> None:
        # Deploy window: the backend has a commit SHA but the manifest doesn't
        # yet list the worker entrypoint, so resolving its URL raises KeyError.
        response = self.client.get(self.url)

        assert response.status_code == 404, response
        # Bailed before attempting any CDN fetch.
        assert mock_urlopen.call_count == 0


@control_silo_test
class ServiceWorkerDiskFallbackTest(TestCase):
    url = "/service-worker.js"

    def setUp(self) -> None:
        super().setUp()
        generic._worker_bundle_cache = None

    def tearDown(self) -> None:
        generic._worker_bundle_cache = None
        super().tearDown()

    @override_settings(DEBUG=False)
    @mock.patch("sentry.web.frontend.generic.get_frontend_commit_sha", return_value=None)
    @mock.patch("sentry.web.frontend.generic.static_media")
    def test_serves_from_disk_when_no_frontend_versions(
        self, mock_static_media: mock.Mock, _sha: mock.Mock
    ) -> None:
        mock_static_media.return_value = HttpResponse(
            b"// disk worker", content_type="text/javascript"
        )

        response = self.client.get(self.url)

        assert response.status_code == 200, response
        assert response.content == b"// disk worker"
        assert response["Service-Worker-Allowed"] == "/"
        assert response["Cache-Control"] == NO_CACHE
        # Looks up the kebab-case entrypoint key that the rspack build emits.
        mock_static_media.assert_called_once_with(
            mock.ANY, module="sentry", path="dist/entrypoints/service-worker.js"
        )
