import orjson

from sentry.integrations.types import IntegrationProviderSlug
from sentry.seer.services.test_generation.model import CreateUnitTestResponse
from sentry.seer.services.test_generation.service import TestGenerationService
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)


class RegionBackedTestGenerationService(TestGenerationService):
    def start_unit_test_generation(
        self, *, region_name: str, github_org: str, repo: str, pr_id: int, external_id: str
    ) -> CreateUnitTestResponse:
        body = orjson.dumps(
            {
                "repo": {
                    "provider": IntegrationProviderSlug.GITHUB.value,
                    "owner": github_org,
                    "name": repo,
                    "external_id": external_id,
                },
                "pr_id": pr_id,
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        response = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            "/v1/automation/codegen/unit-tests",
            body,
        )

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
