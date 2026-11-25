from typing import Any

import orjson

from sentry.lang.native.sources import redact_source_secrets
from sentry.testutils.cases import APITestCase


class ProjectSymbolSourcesTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"

    def test_get_successful(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }
        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps([config]).decode())
        self.login_as(user=self.user)

        expected = redact_source_secrets([config])

        response = self.get_success_response(project.organization.slug, project.slug)
        assert response.data == expected

        response = self.get_success_response(
            project.organization.slug, project.slug, qs_params={"id": "honk"}
        )
        assert response.data == expected

    def test_get_unsuccessful(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }
        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps([config]).decode())
        self.login_as(user=self.user)

        self.get_error_response(
            project.organization.slug, project.slug, qs_params={"id": "hank"}, status_code=404
        )


class ProjectSymbolSourcesDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"
    method = "delete"

    def test_delete_successful(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps([config]).decode())
        self.login_as(user=self.user)

        self.get_success_response(
            project.organization.slug, project.slug, qs_params={"id": "honk"}, status=204
        )

        assert project.get_option("sentry:symbol_sources") == "[]"

    def test_delete_unsuccessful(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps([config]).decode())
        self.login_as(user=self.user)

        self.get_error_response(project.organization.slug, project.slug, status=404)

        self.get_error_response(
            project.organization.slug, project.slug, qs_params={"id": "hank"}, status=404
        )


class ProjectSymbolSourcesPostTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"
    method = "post"

    def test_submit_successful(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        self.login_as(user=self.user)

        expected = redact_source_secrets([config])[0]

        response = self.get_success_response(
            project.organization.slug, project.slug, raw_data=config
        )
        assert response.data == expected

        del config["id"]

        response = self.get_success_response(
            project.organization.slug, project.slug, raw_data=config
        )
        assert "id" in response.data

    azure_config = {
        "id": "honk",
        "name": "honk source",
        "layout": {
            "type": "native",
        },
        "type": "azure",
        "account": "honkaccount",
        "container": "honk",
        "tenant_id": "tenant",
        "client_id": "client",
        "client_secret": "beepbeep",
    }

    def test_submit_azure_successful(self) -> None:
        config = dict(self.azure_config)

        project = self.project  # force creation
        self.login_as(user=self.user)

        with self.feature("organizations:azure-symbol-sources"):
            response = self.get_success_response(
                project.organization.slug, project.slug, raw_data=config
            )
        assert response.data == redact_source_secrets([config])[0]
        assert response.data["client_secret"] == {"hidden-secret": True}

    def test_submit_azure_without_feature(self) -> None:
        project = self.project  # force creation
        self.login_as(user=self.user)

        self.get_error_response(
            project.organization.slug, project.slug, raw_data=dict(self.azure_config)
        )

    def test_submit_duplicate(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps([config]).decode())
        self.login_as(user=self.user)

        self.get_error_response(project.organization.slug, project.slug, raw_data=config)

    def test_submit_invalid_id(self) -> None:
        config = {
            "id": "sentry:project",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        self.login_as(user=self.user)

        self.get_error_response(project.organization.slug, project.slug, raw_data=config)

    def test_submit_invalid_config(self) -> None:
        config = {
            "id": "honk",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        project = self.project  # force creation
        self.login_as(user=self.user)

        self.get_error_response(project.organization.slug, project.slug, raw_data=config)


class ProjectSymbolSourcesPutTest(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"
    method = "put"

    def test_update_successful(self) -> None:
        config = [
            {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            },
            {
                "id": "beep",
                "name": "beep source",
                "layout": {
                    "type": "native",
                },
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            },
        ]

        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps(config).decode())
        self.login_as(user=self.user)

        update_config = {
            "id": "hank",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepboop",
        }

        response = self.get_success_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "honk"},
            raw_data=update_config,
        )
        assert response.data == redact_source_secrets([update_config])[0]

        update_config = {
            "name": "beep source",
            "layout": {
                "type": "native",
            },
            "type": "http",
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepbeep",
        }

        response = self.get_success_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "beep"},
            raw_data=update_config,
        )

        assert "id" in response.data
        del response.data["id"]
        assert response.data == redact_source_secrets([update_config])[0]

        source_ids = {
            src["id"] for src in orjson.loads(project.get_option("sentry:symbol_sources"))
        }

        assert "hank" in source_ids
        assert "beep" not in source_ids

    def test_update_unsuccessful(self) -> None:
        config = [
            {
                "id": "honk",
                "name": "honk source",
                "layout": {
                    "type": "native",
                },
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            },
            {
                "id": "beep",
                "name": "beep source",
                "layout": {
                    "type": "native",
                },
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "beepbeep",
            },
        ]

        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps(config).decode())
        self.login_as(user=self.user)

        update_config = {
            "id": "hank",
            "name": "honk source",
            "layout": {
                "type": "native",
            },
            "url": "http://honk.beep",
            "username": "honkhonk",
            "password": "beepboop",
        }

        self.get_error_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "hank"},
            raw_data=update_config,
            status=404,
        )

        self.get_error_response(
            project.organization.slug, project.slug, raw_data=update_config, status=404
        )

        self.get_error_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "honk"},
            raw_data=update_config,
            status=400,
        )

    def _two_sources(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "honk",
                "name": "honk source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "http://honk.beep",
                "username": "honkhonk",
                "password": "honkpassword",
            },
            {
                "id": "beep",
                "name": "beep source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "http://beep.boop",
                "username": "beepbeep",
                "password": "beeppassword",
            },
        ]

    def test_update_redacted_secret_keeps_secret(self) -> None:
        project = self.project  # force creation
        project.update_option("sentry:symbol_sources", orjson.dumps(self._two_sources()).decode())
        self.login_as(user=self.user)

        update_config = redact_source_secrets(self._two_sources())[0]
        update_config["name"] = "renamed source"

        self.get_success_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "honk"},
            raw_data=update_config,
        )
        saved = orjson.loads(project.get_option("sentry:symbol_sources"))
        assert saved[0]["name"] == "renamed source"
        assert saved[0]["password"] == "honkpassword"

    def test_update_redacted_secret_destination_changed(self) -> None:
        project = self.project  # force creation
        stored = orjson.dumps(self._two_sources()).decode()
        project.update_option("sentry:symbol_sources", stored)
        self.login_as(user=self.user)

        update_config = redact_source_secrets(self._two_sources())[0]
        update_config["url"] = "http://attacker.example"

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "honk"},
            raw_data=update_config,
            status_code=400,
        )
        assert response.data == {
            "error": "Hidden symbol source secret must be provided again when changing `url`"
        }
        assert project.get_option("sentry:symbol_sources") == stored

    def test_update_redacted_secret_from_other_source(self) -> None:
        project = self.project  # force creation
        stored = orjson.dumps(self._two_sources()).decode()
        project.update_option("sentry:symbol_sources", stored)
        self.login_as(user=self.user)

        # Replace `honk` with a copy of `beep` (including its id), hoping to have beep's password
        # restored into the replacement. The secret must come from `honk`, the source being
        # replaced, whose destination differs.
        update_config = redact_source_secrets(self._two_sources())[1]

        response = self.get_error_response(
            project.organization.slug,
            project.slug,
            qs_params={"id": "honk"},
            raw_data=update_config,
            status_code=400,
        )
        assert response.data == {
            "error": "Hidden symbol source secret must be provided again when changing `url`"
        }
        assert project.get_option("sentry:symbol_sources") == stored
