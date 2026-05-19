import os

from django.test.utils import override_settings

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.utils.assets import get_frontend_app_asset_url
from sentry.web.constants import FOREVER_CACHE, IMMUTABLE_CACHE, NEVER_CACHE, NO_CACHE


class StaticMediaTest(TestCase):
    @override_settings(DEBUG=False)
    def test_basic(self) -> None:
        url = "/_static/sentry/js/ads.js"
        response = self.client.get(url)
        close_streaming_response(response)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == NEVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert response["Access-Control-Allow-Origin"] == "*"
        assert "Content-Encoding" not in response

    @override_settings(DEBUG=False)
    def test_versioned(self) -> None:
        url = "/_static/1234567890/sentry/js/ads.js"
        response = self.client.get(url)
        close_streaming_response(response)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert response["Access-Control-Allow-Origin"] == "*"
        assert "Content-Encoding" not in response

        url = "/_static/a43db3b08ddd4918972f80739f15344b/sentry/js/ads.js"
        response = self.client.get(url)
        close_streaming_response(response)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == FOREVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert response["Access-Control-Allow-Origin"] == "*"
        assert "Content-Encoding" not in response

        with override_settings(DEBUG=True):
            response = self.client.get(url)
            close_streaming_response(response)
            assert response.status_code == 200, response
            assert response["Cache-Control"] == NEVER_CACHE
            assert response["Vary"] == "Accept-Encoding"
            assert response["Access-Control-Allow-Origin"] == "*"

    @override_settings(DEBUG=False)
    def test_frontend_app_assets(self) -> None:
        """
        static assets that do not have versioned filenames/paths
        """

        # non-existant dist file
        response = self.client.get("/_static/dist/sentry/invalid.js")
        assert response.status_code == 404, response

        dist_path = os.path.join("src", "sentry", "static", "sentry", "dist", "entrypoints")
        os.makedirs(dist_path, exist_ok=True)

        try:
            with open(os.path.join(dist_path, "test.js"), "a"):
                url = get_frontend_app_asset_url("sentry", "entrypoints/test.js")

                response = self.client.get(url)
                close_streaming_response(response)
                assert response.status_code == 200, response
                assert response["Cache-Control"] == NO_CACHE
                assert response["Vary"] == "Accept-Encoding"
                assert response["Access-Control-Allow-Origin"] == "*"
                assert "Content-Encoding" not in response

            with override_settings(DEBUG=True):
                response = self.client.get(url)
                close_streaming_response(response)
                assert response.status_code == 200, response
                assert response["Cache-Control"] == NEVER_CACHE
                assert response["Vary"] == "Accept-Encoding"
                assert response["Access-Control-Allow-Origin"] == "*"
        finally:
            try:
                os.unlink(os.path.join(dist_path, "test.js"))
            except Exception:
                pass

    @override_settings(DEBUG=False)
    def test_frontend_app_content_hashed_assets_cached_forever(self) -> None:
        """
        Content-hashed files in chunks/ and assets/ under /_static/dist/
        are immutable and should be cached forever.
        """
        dist_path = os.path.join("src", "sentry", "static", "sentry", "dist")
        cases = [
            ("assets", "rubik-regular.fad64911e39b541f.woff2"),
            ("chunks", "1016.d44eb37649c6e092.js"),
            ("chunks/locale", "zh-cn.4ddebd56c0630d59.js"),
        ]

        created: list[str] = []
        try:
            for subdir, filename in cases:
                dirpath = os.path.join(dist_path, subdir)
                os.makedirs(dirpath, exist_ok=True)
                filepath = os.path.join(dirpath, filename)
                with open(filepath, "a"):
                    pass
                created.append(filepath)

                url = f"/_static/dist/sentry/{subdir}/{filename}"
                response = self.client.get(url)
                close_streaming_response(response)
                assert response.status_code == 200, f"{url} returned {response.status_code}"
                assert response["Cache-Control"] == IMMUTABLE_CACHE, (
                    f"{url} got {response['Cache-Control']}, expected FOREVER_CACHE"
                )
        finally:
            for fp in created:
                try:
                    os.unlink(fp)
                except Exception:
                    pass

    @override_settings(DEBUG=False)
    def test_frontend_app_unhashed_assets_not_cached_forever(self) -> None:
        """
        Files without a content hash or in entrypoints/ should NOT get
        FOREVER_CACHE, even if they happen to be in chunks/ or assets/.
        """
        dist_path = os.path.join("src", "sentry", "static", "sentry", "dist")
        cases = [
            ("entrypoints", "app.js"),
            ("assets", "no-hash.svg"),
            ("chunks", "no-hash.js"),
        ]

        created: list[str] = []
        try:
            for subdir, filename in cases:
                dirpath = os.path.join(dist_path, subdir)
                os.makedirs(dirpath, exist_ok=True)
                filepath = os.path.join(dirpath, filename)
                with open(filepath, "a"):
                    pass
                created.append(filepath)

                url = f"/_static/dist/sentry/{subdir}/{filename}"
                response = self.client.get(url)
                close_streaming_response(response)
                assert response.status_code == 200, f"{url} returned {response.status_code}"
                assert response["Cache-Control"] == NO_CACHE, (
                    f"{url} got {response['Cache-Control']}, expected NO_CACHE"
                )
        finally:
            for fp in created:
                try:
                    os.unlink(fp)
                except Exception:
                    pass

    @override_settings(DEBUG=False)
    def test_no_cors(self) -> None:
        url = "/_static/sentry/images/favicon.ico"
        response = self.client.get(url)
        close_streaming_response(response)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == NEVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert "Access-Control-Allow-Origin" not in response
        assert "Content-Encoding" not in response

    def test_404(self) -> None:
        url = "/_static/sentry/app/thisfiledoesnotexistlol.js"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_gzip(self) -> None:
        url = "/_static/sentry/js/ads.js"
        response = self.client.get(url, HTTP_ACCEPT_ENCODING="gzip,deflate")
        close_streaming_response(response)
        assert response.status_code == 200, response
        assert response["Vary"] == "Accept-Encoding"
        assert "Content-Encoding" not in response

        try:
            with open("src/sentry/static/sentry/js/ads.js.gz", "a"):
                pass

            # Not a gzip Accept-Encoding, so shouldn't serve gzipped file
            response = self.client.get(url, HTTP_ACCEPT_ENCODING="lol")
            close_streaming_response(response)
            assert response.status_code == 200, response
            assert response["Vary"] == "Accept-Encoding"
            assert "Content-Encoding" not in response

            response = self.client.get(url, HTTP_ACCEPT_ENCODING="gzip,deflate")
            close_streaming_response(response)
            assert response.status_code == 200, response
            assert response["Vary"] == "Accept-Encoding"
            assert response["Content-Encoding"] == "gzip"
        finally:
            try:
                os.unlink("src/sentry/static/sentry/js/ads.js.gz")
            except Exception:
                pass

    def test_file_not_found(self) -> None:
        url = "/_static/sentry/app/xxxxxxxxxxxxxxxxxxxxxxxx.js"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_bad_access(self) -> None:
        url = "/_static/sentry/images/../../../../../etc/passwd"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_directory(self) -> None:
        url = "/_static/sentry/images/"
        response = self.client.get(url)
        assert response.status_code == 404, response

        url = "/_static/sentry/images"
        response = self.client.get(url)
        assert response.status_code == 404, response
