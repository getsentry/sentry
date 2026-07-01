"""
DO NOT MERGE — dummy endpoint added by Junior to test CI behavior.

This endpoint exists solely to trigger the `api-url-typescript` job in
backend.yml (which fires whenever a urls.py changes). That job runs
`python3 -m tools.api_urls_to_typescript` and commits the updated
`knownSentryApiUrls.generated.ts` back to the PR branch. The test PR
targeting `fix/fe-be-warning-exclude-generated-files` validates that
the new `frontend_non_generated` filter prevents that bot commit from
triggering the spurious "FE+BE changes" warning.

See: https://github.com/getsentry/sentry/pull/118795
"""

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint


@region_silo_endpoint
class OrganizationDummyJuniorTestEndpoint(Endpoint):
    """Dummy endpoint — DO NOT MERGE."""

    private = True

    def get(self, request: Request, organization_id_or_slug: str) -> Response:
        return Response({"ok": True})
