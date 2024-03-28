from __future__ import annotations

import logging

from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.event_ai_suggested_fix import get_openai_policy
from sentry.constants import ObjectStatus
from sentry.models.group import Group
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service

logger = logging.getLogger(__name__)

from rest_framework.request import Request


def get_autofix_integration_setup_problems(organization: Organization) -> str | None:
    """
    Runs through the checks to see if we can use the GitHub integration for Autofix.

    If there are no issues, returns None.
    If there is an issue, returns the reason.
    """
    integrations = integration_service.get_organization_integrations(
        organization_id=organization.id, providers=["github"], limit=1
    )

    integration = integrations[0] if integrations else None

    if not integration:
        return "integration_missing"

    if integration.status != ObjectStatus.ACTIVE:
        return "integration_inactive"

    if not RepositoryProjectPathConfig.objects.filter(
        organization_integration_id=integration.id
    ).exists():
        return "integration_no_code_mappings"

    return None


@region_silo_endpoint
class GroupAutofixSetupCheck(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    def get(self, request: Request, group: Group) -> Response:
        """
        Checks if we are able to run Autofix on the given group.
        """
        if not features.has("projects:ai-autofix", group.project):
            return Response({"detail": "Feature not enabled for project"}, status=403)

        policy = get_openai_policy(
            request.organization,
            request.user,
            pii_certified=True,
        )

        requires_subprocessor_consent = policy == "subprocessor"

        org: Organization = request.organization
        has_gen_ai_consent = org.get_option("sentry:gen_ai_consent", False)

        integration_check = get_autofix_integration_setup_problems(organization=org)

        return Response(
            {
                "subprocessorConsent": {
                    "ok": not requires_subprocessor_consent,
                    "reason": None,
                },
                "genAIConsent": {
                    "ok": has_gen_ai_consent,
                    "reason": None,
                },
                "integration": {
                    "ok": integration_check is None,
                    "reason": integration_check,
                },
            }
        )
