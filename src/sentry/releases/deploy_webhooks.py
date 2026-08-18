from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any
from urllib.parse import quote, urlencode

from sentry import features
from sentry.api.serializers import serialize
from sentry.models.deploy import Deploy
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import DeployActionType, SentryAppResourceType

logger = logging.getLogger(__name__)

DEPLOY_WEBHOOKS_FEATURE = "organizations:deploy-webhooks"


def build_deploy_webhook_payload(
    deploy: Deploy, projects: Sequence[Project], organization: Organization
) -> dict[str, dict[str, Any]]:
    """
    Build the ``deploy.created`` webhook payload for a given deploy.

    Wraps the public Deploy API representation, adding the deployed release version,
    the projects the deploy targeted, and a Sentry permalink to the release. Datetimes
    are rendered as ISO 8601 strings because this payload is handed to a task and then
    JSON-encoded for delivery.

    Note the two distinct URLs: ``url`` is the user-supplied deploy link (often a CI
    build, and frequently absent), while ``web_url`` always points back into Sentry.
    """
    deploy_data: dict[str, Any] = dict(serialize(deploy))

    for date_field in ("dateStarted", "dateFinished"):
        value = deploy_data.get(date_field)
        if value is not None:
            deploy_data[date_field] = value.isoformat()

    deploy_data["release"] = {"version": deploy.release.version}
    deploy_data["projects"] = [{"slug": project.slug} for project in projects]
    deploy_data["web_url"] = _build_release_web_url(
        organization, deploy.release.version, deploy_data.get("environment")
    )

    return {"deploy": deploy_data}


def _build_release_web_url(
    organization: Organization, version: str, environment: str | None
) -> str:
    """
    Permalink to the deployed release in Sentry, scoped to the deploy's environment.

    A deploy can span several projects, so this links to the release rather than to any
    one project's view of it. ``absolute_url`` handles customer domains. The version is
    quoted because ``?``, ``#`` and spaces are all legal in release versions (only
    ``BAD_RELEASE_CHARS`` are rejected) and would otherwise corrupt the URL.
    """
    return organization.absolute_url(
        f"/organizations/{organization.slug}/releases/{quote(version, safe='')}/",
        query=urlencode({"environment": environment}) if environment else None,
    )


def send_deploy_created_webhook(deploy: Deploy, projects: Sequence[Project]) -> None:
    """
    Send the ``deploy.created`` webhook for a given deploy, if applicable.

    Builds the payload and enqueues via the generic broadcaster.
    Fully fire-and-forget: exceptions are logged but never propagated, so a failure
    here can never fail the deploy that triggered it.
    """
    try:
        organization = Organization.objects.get_from_cache(id=deploy.organization_id)
        if not features.has(DEPLOY_WEBHOOKS_FEATURE, organization):
            return

        broadcast_webhooks_for_organization.delay(
            resource_name=SentryAppResourceType.DEPLOY.value,
            event_name=DeployActionType.CREATED.value,
            organization_id=deploy.organization_id,
            payload=build_deploy_webhook_payload(deploy, projects, organization),
        )
    except Exception:
        logger.exception(
            "releases.deploy.webhook.failed",
            extra={
                "deploy_id": deploy.id,
                "organization_id": deploy.organization_id,
            },
        )
