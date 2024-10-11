import orjson
import requests
from django.conf import settings

from sentry.seer.services.test_generation.model import CreateUnitTestResponse
from sentry.seer.services.test_generation.service import TestGenerationService


class RegionBackedTestGenerationService(TestGenerationService):
    def start_unit_test_generation(
        self, *, region_name: str, github_org: str, repo: str, pr_id: int, external_id: str
    ) -> CreateUnitTestResponse:
        url = f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/unit-tests"
        body = orjson.dumps(
            {
                "repo": {
                    "provider": "github",
                    "owner": github_org,
                    "name": repo,
                    "external_id": external_id,
                },
                "pr_id": pr_id,
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        response = requests.post(
            url,
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
            },
        )

        if response.status_code == 200:
            return CreateUnitTestResponse()
        else:
            return CreateUnitTestResponse(error_detail=response.text)
