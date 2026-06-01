"""
GitLab merge_request webhook processor that seeds OrganizationContributors so
seat-based Seer billing works once an org is moved onto
``organizations:seat-based-seer-enabled``.

Mirrors the GitHub side, where ``track_contributor_seat`` runs from the
``pull_request opened`` webhook (see
``sentry/integrations/github/webhook.py``). Only fires on MR-open events
(GitLab's ``object_attributes.action == "open"``); the GitLab merge_request
webhook also delivers update/close/merge events that should not seed a
contributor.

Gated by ``organizations:seer-code-review-gitlab`` — the same cohort flag
``handle_merge_request_event`` uses — so seeding only happens for orgs that
are already opted in to GitLab code review. The downstream call to
``should_increment_contributor_seat`` additionally requires
``organizations:seat-based-seer-enabled`` before any row is actually written
or a seat is assigned.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.contributor_seats import track_contributor_seat

logger = logging.getLogger(__name__)


def track_gitlab_contributor_seat_processor(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    if integration is None:
        return
    if not features.has("organizations:seer-code-review-gitlab", organization):
        return

    object_attributes = event.get("object_attributes") or {}
    if object_attributes.get("action") != "open":
        return

    try:
        user_id = object_attributes["author_id"]
        user_username = event["user"]["username"]
    except KeyError as e:
        logger.warning(
            "gitlab.webhook.seat_tracking.missing-author-data",
            extra={"integration_id": integration.id, "error": str(e)},
        )
        return

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        return

    track_contributor_seat(
        organization=org,
        repo=repo,
        integration_id=integration.id,
        user_id=user_id,
        user_username=user_username,
        provider="gitlab",
    )
