from sentry.lang.native.sources import redact_source_secrets
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json


@region_silo_test(stable=True)
class ProjectSymbolSourcesTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"

    def test_simple(self):
        with Feature(
            {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}
        ):
            config = {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "filetypes": ["pe"],
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            }
            project = self.project  # force creation
            project.update_option("sentry:symbol_sources", json.dumps([config]))
            self.login_as(user=self.user)

            response = self.get_success_response(project.organization.slug, project.slug)
            assert response.data == redact_source_secrets([config])

            response = self.get_success_response(
                project.organization.slug, project.slug, qs_params={"id": "honk"}
            )
            assert response.data == redact_source_secrets([config])[0]

            self.get_error_response(
                project.organization.slug, project.slug, qs_params={"id": "hank"}, status_code=404
            )


@region_silo_test(stable=True)
class ProjectSymbolSourcesPostTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"
    method = "post"

    def test_submit_successful(self):
        with Feature(
            {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}
        ):
            config = {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "filetypes": ["pe"],
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            }

            project = self.project  # force creation
            self.login_as(user=self.user)

            response = self.get_success_response(
                project.organization.slug, project.slug, raw_data=config
            )
            assert response.data == {"id": "honk"}

            del config["id"]

            response = self.get_success_response(
                project.organization.slug, project.slug, raw_data=config
            )
            assert "id" in response

    def test_submit_duplicate(self):
        with Feature(
            {"organizations:symbol-sources": True, "organizations:custom-symbol-sources": True}
        ):
            config = {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "filetypes": ["pe"],
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            }

            project = self.project  # force creation
            project.update_option("sentry:symbol_sources", json.dumps([config]))
            self.login_as(user=self.user)

            response = self.get_error_response(
                project.organization.slug, project.slug, raw_data=config
            )
            assert response.data == {"error": "Duplicate source id: honk"}
