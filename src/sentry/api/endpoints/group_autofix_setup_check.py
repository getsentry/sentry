from __future__ import annotations

import logging

import requests
from django.conf import settings
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.event_ai_suggested_fix import get_openai_policy
from sentry.api.helpers.autofix import (
    AutofixCodebaseIndexingStatus,
    get_project_codebase_indexing_status,
)
from sentry.api.helpers.repos import get_repos_from_project_code_mappings
from sentry.constants import ObjectStatus
from sentry.models.group import Group
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils import json

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


def get_repos_and_access(project: Project) -> list[dict]:
    """
    Gets the repos that would be indexed for the given project from the code mappings, and checks if we have write access to them.

    Returns a list of repos with the "ok" key set to True if we have write access, False otherwise.
    """
    repos = get_repos_from_project_code_mappings(project)

    repos_and_access: list[dict] = []
    for repo in repos:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codebase/repo/check-access",
            data=json.dumps(
                {
                    "repo": repo,
                }
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

        repos_and_access.append({**repo, "ok": response.json().get("has_access", False)})

    return repos_and_access


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

        repos = get_repos_and_access(group.project)
        write_access_ok = all(repo["ok"] for repo in repos)

        codebase_indexing_status = get_project_codebase_indexing_status(group.project)

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
                "githubWriteIntegration": {
                    "ok": write_access_ok,
                    "repos": repos,
                },
                "codebaseIndexing": {
                    "ok": codebase_indexing_status == AutofixCodebaseIndexingStatus.UP_TO_DATE
                    or codebase_indexing_status == AutofixCodebaseIndexingStatus.INDEXING,
                },
            }
        )
