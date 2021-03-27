from sentry.testutils import AcceptanceTestCase


class TestChartRenderer(AcceptanceTestCase):
    def test_debug_renders(self):
        options = {
            "chart-rendering.enabled": True,
            "system.url-prefix": self.browser.live_server_url,
        }

        with self.options(options):
            self.browser.get("debug/chart-renderer/")

        images = self.browser.elements(selector="img")
        assert len(images) == 1

        for image in images:
            src = image.get_attribute("src")
            resp = self.client.get(src)

            # Ensure our chart images actually look like pngs
            assert resp.status_code == 200
            assert next(resp.streaming_content)[:4] == b"\x89PNG"

        self.browser.snapshot("chart renderer debug view via chartcuterie")
