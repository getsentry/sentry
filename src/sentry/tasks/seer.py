from __future__ import annotations
from typing import int

import logging

import orjson
import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.cleanup_seer_repository_preferences",
    namespace=seer_tasks,
    processing_deadline_duration=60 * 5,
    silo_mode=SiloMode.REGION,
)
def cleanup_seer_repository_preferences(
    organization_id: int, repo_external_id: str, repo_provider: str
) -> None:
    """
    Clean up Seer preferences for a deleted repository.

    This task removes a repository from Seer organization preferences when the repository
    is deleted from an organization's integration.
    """
    # Call Seer API to remove repository from organization preferences
    path = "/v1/project-preference/remove-repository"
    body = orjson.dumps(
        {
            "organization_id": organization_id,
            "repo_provider": repo_provider,
            "repo_external_id": repo_external_id,
        }
    )

    try:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )
        response.raise_for_status()
        logger.info(
            "cleanup_seer_repository_preferences.success",
            extra={
                "organization_id": organization_id,
                "repo_external_id": repo_external_id,
                "repo_provider": repo_provider,
            },
        )
    except Exception as e:
        logger.exception(
            "cleanup_seer_repository_preferences.failed",
            extra={
                "organization_id": organization_id,
                "repo_external_id": repo_external_id,
                "repo_provider": repo_provider,
                "error": str(e),
            },
        )
        raise
