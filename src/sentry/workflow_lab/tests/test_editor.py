from pathlib import Path
from unittest.mock import patch

import orjson
from django.test import override_settings
from django.urls import include, path
from urllib3.response import HTTPResponse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

urlpatterns = [
    path("workflow-lab/", include("sentry.workflow_lab.urls")),
    path("", include("sentry.conf.urls")),
]


@with_feature("organizations:investigations")
@override_settings(DEBUG=True, ROOT_URLCONF=__name__)
class WorkflowLabTest(APITestCase):
    def test_standalone_shell(self):
        self.login_as(self.user)
        base = f"/workflow-lab/{self.organization.slug}/"
        response = self.client.get(base)
        assert response.status_code == 200
        shell = response.content.decode()
        assert "entrypoints/app.js" not in shell
        assert 'type="module" src="assets/lab.js"' in shell
        assert (
            shell.index('data-view="output"')
            < shell.index('data-view="notebook"')
            < shell.index('data-view="state"')
        )
        for asset in (Path(__file__).resolve().parents[1] / "assets").rglob("*"):
            if asset.suffix in {".css", ".js"}:
                response = self.client.get(
                    base
                    + "assets/"
                    + str(asset.relative_to(Path(__file__).resolve().parents[1] / "assets"))
                )
                assert response.status_code == 200
        frame = self.client.get(base + "notebook/")
        assert frame.status_code == 200
        assert frame["X-Frame-Options"] == "SAMEORIGIN"
        assert "workflowNotebook.js" in frame.content.decode()
        assert "entrypoints/app.js" not in frame.content.decode()

    @override_settings(SEER_API_SHARED_SECRET="standalone-editor-test-shared-secret")
    def test_catalog_and_validation(self):
        self.login_as(self.user)
        base = f"/workflow-lab/{self.organization.slug}/editor/"
        with patch(
            "sentry.investigations.endpoints.workflow_runs.seer_autofix_default_connection_pool"
        ) as pool:
            pool.scheme, pool.host, pool.port = "http", "localhost", 9091
            pool.urlopen.return_value = HTTPResponse(
                body=orjson.dumps({"definitions": [{"name": "breached_metrics"}], "registry": {}}),
                status=200,
            )
            result = self.client.get(base)
            assert result.status_code == 200, result.content
            assert "breached_metrics" in result.data["examples"]
            pool.urlopen.return_value = HTTPResponse(body=b'{"order":["judge"]}', status=200)
            result = self.client.post(
                base, {"action": "validate", "workflow": {}, "input": {}}, format="json"
            )
            assert result.status_code == 200
            assert pool.urlopen.call_args.args == (
                "POST",
                "/v1/automation/investigation-workflows/validate",
            )

    def test_anonymous(self):
        base = f"/workflow-lab/{self.organization.slug}/"
        assert self.client.get(base).status_code == 302
        assert self.client.get(base + "editor/").status_code in (401, 403)

    @override_settings(DEBUG=False)
    def test_editor_closed_outside_development(self):
        self.login_as(self.user)
        base = f"/workflow-lab/{self.organization.slug}/"
        assert self.client.get(base).status_code == 404
        assert self.client.get(base + "editor/").status_code == 404

    def test_sentry_urls_without_optional_package(self):
        from importlib.util import find_spec
        from runpy import run_path

        from sentry.web import urls

        def without_editor(name):
            return None if name == "sentry.workflow_lab" else find_spec(name)

        with patch("importlib.util.find_spec", without_editor):
            routes = run_path(urls.__file__)["urlpatterns"]
        assert routes
        assert all("workflow-lab/" not in str(route.pattern) for route in routes)
