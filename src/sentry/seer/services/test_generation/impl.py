from sentry.integrations.types import IntegrationProviderSlug
from sentry.seer.services.test_generation.model import CreateUnitTestResponse
from sentry.seer.services.test_generation.service import TestGenerationService
from sentry.seer.signed_seer_api import UnitTestGenerationRequest, make_unit_test_generation_request


class RegionBackedTestGenerationService(TestGenerationService):
    def start_unit_test_generation(
        self, *, region_name: str, github_org: str, repo: str, pr_id: int, external_id: str
    ) -> CreateUnitTestResponse:
        body = UnitTestGenerationRequest(
            repo={
                "provider": IntegrationProviderSlug.GITHUB.value,
                "owner": github_org,
                "name": repo,
                "external_id": external_id,
            },
            pr_id=pr_id,
        )
        response = make_unit_test_generation_request(body)

        if response.status == 200:
            return CreateUnitTestResponse()
        else:
            try:
                error_detail = response.data.decode("utf-8") if response.data else None
            except (AttributeError, UnicodeDecodeError):
                error_detail = None
            return CreateUnitTestResponse(
                error_detail=error_detail or f"Request failed with status {response.status}"
            )
