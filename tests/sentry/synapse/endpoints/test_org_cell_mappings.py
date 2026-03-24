from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import APITestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, RegionCategory

us_region = Cell("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
de_region = Cell("de", 2, "https://de.testserver", RegionCategory.MULTI_TENANT)
region_config = (us_region, de_region)


@control_silo_test
@override_settings(SYNAPSE_HMAC_SECRET=["a-long-value-that-is-hard-to-guess"])
class OrgCellMappingsTest(APITestCase):
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
        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(url)
        assert res.status_code == 401

    def test_get_no_allow_cookie_auth(self) -> None:
        self.login_as(self.user)
        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(url)
        assert res.status_code == 401

    def test_get_invalid_auth(self) -> None:
        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            HTTP_AUTHORIZATION="Signature total:trash",
        )
        assert res.status_code == 401

    def test_get_no_data(self) -> None:
        url = reverse("sentry-api-0-org-cell-mappings")
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

    @override_cells(region_config)
    def test_get_results_no_next(self) -> None:
        org1 = self.create_organization()
        org2 = self.create_organization()
        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {"id": str(org1.id), "slug": org1.slug, "cell": "us"}
        assert res.data["data"][1] == {"id": str(org2.id), "slug": org2.slug, "cell": "us"}
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"] is False

    @override_cells(region_config)
    def test_get_next_page(self) -> None:
        # newest orgs are in next page (ascending order by date_updated).
        org1 = self.create_organization()
        org2 = self.create_organization()
        self.create_organization()
        self.create_organization()

        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            data={"per_page": 2},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {"id": str(org1.id), "slug": org1.slug, "cell": "us"}
        assert res.data["data"][1] == {"id": str(org2.id), "slug": org2.slug, "cell": "us"}
        assert len(res.data["data"]) == 2
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"]

    @override_cells(region_config)
    def test_get_multiple_pages_multiple_locales(self) -> None:
        org1 = self.create_organization()
        org2 = self.create_organization()
        org3 = self.create_organization(region=de_region)
        org4 = self.create_organization(region=de_region)

        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            data={"per_page": 2},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {"id": str(org1.id), "slug": org1.slug, "cell": "us"}
        assert res.data["data"][1] == {"id": str(org2.id), "slug": org2.slug, "cell": "us"}
        assert len(res.data["data"]) == 2
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"]

        # Fetch the next page
        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            data={"per_page": 2, "cursor": res.data["metadata"]["cursor"]},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200, res.content
        assert res.data["data"][0] == {"id": str(org3.id), "slug": org3.slug, "cell": "de"}
        assert res.data["data"][1] == {"id": str(org4.id), "slug": org4.slug, "cell": "de"}
        assert len(res.data["data"]) == 2
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"] is False

    @override_cells(region_config)
    def test_get_locale_filter(self) -> None:
        # Two orgs in the wrong region to check pagination response data
        self.create_organization()
        self.create_organization()
        org3 = self.create_organization(region=de_region)

        url = reverse("sentry-api-0-org-cell-mappings")
        res = self.client.get(
            url,
            data={"locality": "de"},
            HTTP_AUTHORIZATION=self.auth_header(url),
        )
        assert res.status_code == 200
        assert res.data["data"][0] == {"id": str(org3.id), "slug": org3.slug, "cell": "de"}
        assert len(res.data["data"]) == 1
        assert res.data["metadata"]["cursor"]
        assert res.data["metadata"]["cell_to_locality"]
        assert res.data["metadata"]["has_more"] is False
