import itertools
import uuid

from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.models.projectkeymapping import ProjectKeyMapping
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import APITestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, RegionCategory

us_cell = Cell("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
de_cell = Cell("de", 2, "https://de.testserver", RegionCategory.MULTI_TENANT)
cell_config = (us_cell, de_cell)


_project_key_id = itertools.count(1)


def create_project_key_mapping(cell_name: str) -> ProjectKeyMapping:
    return ProjectKeyMapping.objects.create(
        project_key_id=next(_project_key_id),
        public_key=uuid.uuid4().hex[:32],
        cell_name=cell_name,
    )


@control_silo_test
@override_settings(SYNAPSE_HMAC_SECRET=["a-long-value-that-is-hard-to-guess"])
class ProjectKeyCellMappingsTest(APITestCase):
    def auth_header(self, path: str) -> str:
        signature = generate_service_request_signature(
            url_path=path,
            body=b"",
            shared_secret_setting=settings.SYNAPSE_HMAC_SECRET,
            service_name="Synapse",
            signature_prefix="synapse0",
            include_url_in_signature=True,
        )
        return f"Signature {signature}"

    def test_get_no_auth(self) -> None:
        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(url)
        assert res.status_code == 401

    def test_get_no_allow_cookie_auth(self) -> None:
        self.login_as(self.user)
        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(url)
        assert res.status_code == 401

    def test_get_invalid_auth(self) -> None:
        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(
            url,
            HTTP_AUTHORIZATION="Signature total:trash",
        )
        assert res.status_code == 401

    def test_get_no_data(self) -> None:
        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(
            url,
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"] == []
        assert "metadata" in res.data
        assert "cursor" in res.data["metadata"]
        assert "cell_to_locality" in res.data["metadata"]
        assert res.data["metadata"]["has_more"] is False

    @override_cells(cell_config)
    def test_get_multiple_pages_multiple_cells(self) -> None:
        m1 = create_project_key_mapping("us")
        m2 = create_project_key_mapping("us")
        m3 = create_project_key_mapping("de")
        m4 = create_project_key_mapping("de")

        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(
            url,
            data={"per_page": 2},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {
            "id": str(m1.project_key_id),
            "publickey": m1.public_key,
            "cell": "us",
        }
        assert res.data["data"][1] == {
            "id": str(m2.project_key_id),
            "publickey": m2.public_key,
            "cell": "us",
        }
        assert len(res.data["data"]) == 2
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"]

        res = self.client.get(
            url,
            data={"per_page": 2, "cursor": res.data["metadata"]["cursor"]},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200, res.content
        assert res.data["data"][0] == {
            "id": str(m3.project_key_id),
            "publickey": m3.public_key,
            "cell": "de",
        }
        assert res.data["data"][1] == {
            "id": str(m4.project_key_id),
            "publickey": m4.public_key,
            "cell": "de",
        }
        assert len(res.data["data"]) == 2
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"] is False

    @override_cells(cell_config)
    def test_get_locale_filter(self) -> None:
        create_project_key_mapping("us")
        create_project_key_mapping("us")
        m3 = create_project_key_mapping("de")

        url = reverse("sentry-api-0-projectkey-cell-mappings")
        res = self.client.get(
            url,
            data={"locality": "de"},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {
            "id": str(m3.project_key_id),
            "publickey": m3.public_key,
            "cell": "de",
        }
        assert len(res.data["data"]) == 1
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"] is False
