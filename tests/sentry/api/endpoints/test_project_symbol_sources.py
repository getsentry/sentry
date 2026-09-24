import orjson

from sentry.lang.native.sources import HIDDEN_SECRET, redact_source_secrets
from sentry.testutils.cases import APITestCase


def http_source(source_id: str, password: str = "beepbeep") -> dict:
    return {
        "id": source_id,
        "name": f"{source_id} source",
        "layout": {"type": "native"},
        "type": "http",
        "url": "http://honk.beep",
        "username": "honkhonk",
        "password": password,
    }


class SymbolSourcesTestCase(APITestCase):
    endpoint = "sentry-api-0-project-symbol-sources"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def store(self, *sources: dict) -> None:
        self.project.update_option("sentry:symbol_sources", orjson.dumps(list(sources)).decode())

    def stored(self) -> list[dict]:
        return orjson.loads(self.project.get_option("sentry:symbol_sources"))


class ProjectSymbolSourcesGetTest(SymbolSourcesTestCase):
    def test_list_and_lookup_redact_secrets(self) -> None:
        config = http_source("honk")
        self.store(config)
        expected = redact_source_secrets([config])

        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == expected

        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "honk"}
        )
        assert response.data == expected

    def test_unknown_id(self) -> None:
        self.store(http_source("honk"))

        response = self.get_error_response(
            self.organization.slug, self.project.slug, qs_params={"id": "hank"}, status_code=404
        )
        assert response.data == {"error": "Unknown source id: hank"}


class ProjectSymbolSourcesDeleteTest(SymbolSourcesTestCase):
    method = "delete"

    def test_delete(self) -> None:
        self.store(http_source("honk"), http_source("beep"))

        self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "honk"}, status_code=204
        )

        assert [source["id"] for source in self.stored()] == ["beep"]

    def test_missing_or_unknown_id(self) -> None:
        self.store(http_source("honk"))

        response = self.get_error_response(
            self.organization.slug, self.project.slug, status_code=404
        )
        assert response.data == {"error": "Missing source id"}

        response = self.get_error_response(
            self.organization.slug, self.project.slug, qs_params={"id": "hank"}, status_code=404
        )
        assert response.data == {"error": "Unknown source id: hank"}
        assert [source["id"] for source in self.stored()] == ["honk"]


class ProjectSymbolSourcesPostTest(SymbolSourcesTestCase):
    method = "post"

    def test_add(self) -> None:
        config = http_source("honk")

        response = self.get_success_response(
            self.organization.slug, self.project.slug, raw_data=config, status_code=201
        )
        assert response.data == redact_source_secrets([config])[0]
        assert self.stored() == [config]

    def test_add_assigns_id(self) -> None:
        config = http_source("honk")
        del config["id"]

        response = self.get_success_response(
            self.organization.slug, self.project.slug, raw_data=config, status_code=201
        )
        assert response.data["id"]
        assert self.stored()[0]["id"] == response.data["id"]

    def test_duplicate_id(self) -> None:
        self.store(http_source("honk"))

        response = self.get_error_response(
            self.organization.slug, self.project.slug, raw_data=http_source("honk"), status_code=400
        )
        assert response.data == {"error": "Duplicate source id: honk"}

    def test_internal_id(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            raw_data=http_source("sentry:project"),
            status_code=400,
        )
        assert response.data == {"error": 'Source ids must not start with "sentry:"'}

    def test_invalid_config(self) -> None:
        config = http_source("honk")
        del config["type"]

        response = self.get_error_response(
            self.organization.slug, self.project.slug, raw_data=config, status_code=400
        )
        assert response.data["error"].startswith("Failed to validate source")
        assert "beepbeep" not in response.data["error"]
        assert self.project.get_option("sentry:symbol_sources") is None


class ProjectSymbolSourcesPutTest(SymbolSourcesTestCase):
    method = "put"

    def test_replace_and_rename(self) -> None:
        self.store(http_source("honk"), http_source("beep"))
        update = http_source("hank", password="beepboop")

        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "honk"}, raw_data=update
        )
        assert response.data == redact_source_secrets([update])[0]
        assert self.stored() == [update, http_source("beep")]

    def test_replace_assigns_id(self) -> None:
        self.store(http_source("honk"), http_source("beep"))
        update = http_source("beep")
        del update["id"]

        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "beep"}, raw_data=update
        )
        new_id = response.data.pop("id")
        assert new_id and new_id != "beep"
        assert response.data == redact_source_secrets([update])[0]
        assert [source["id"] for source in self.stored()] == ["honk", new_id]

    def test_hidden_secret_is_backfilled(self) -> None:
        self.store(http_source("honk", password="original"))
        update = http_source("honk", password="changed")
        update["password"] = HIDDEN_SECRET

        self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "honk"}, raw_data=update
        )
        assert self.stored() == [http_source("honk", password="original")]

    def test_hidden_secret_is_backfilled_across_rename(self) -> None:
        self.store(http_source("honk", password="original"))
        update = http_source("hank")
        update["password"] = HIDDEN_SECRET

        self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"id": "honk"}, raw_data=update
        )
        assert self.stored() == [http_source("hank", password="original")]

    def test_missing_or_unknown_id(self) -> None:
        self.store(http_source("honk"))

        response = self.get_error_response(
            self.organization.slug, self.project.slug, raw_data=http_source("hank"), status_code=404
        )
        assert response.data == {"error": "Missing source id"}

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"id": "hank"},
            raw_data=http_source("hank"),
            status_code=404,
        )
        assert response.data == {"error": "Unknown source id: hank"}
        assert self.stored() == [http_source("honk")]

    def test_invalid_config(self) -> None:
        self.store(http_source("honk"))
        update = http_source("honk")
        del update["type"]

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"id": "honk"},
            raw_data=update,
            status_code=400,
        )
        assert response.data["error"].startswith("Failed to validate source")
        assert self.stored() == [http_source("honk")]
