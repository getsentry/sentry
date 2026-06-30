"""
GitLab merge_request webhook processor that seeds OrganizationContributors and
records contributor actions so seat-based Seer billing works once an org is
moved onto ``organizations:seat-based-seer-enabled``. Same goal as GitHub's
``record_contributor_action`` call in ``_track_contributor_action_processor``
(see ``sentry/integrations/github/webhook.py``).

``record_contributor_action`` seeds the contributor  on every delivery and,
for an eligible MR *open*, creates an ``OrganizationContributorAction`` row
keyed by ``(repository_id, pr_number)``. ``num_actions`` is only incremented
when that row is newly created, so the unique constraint absorbs GitLab's
redeliveries without double-counting.

Gated by ``organizations:seer-gitlab-support`` — the same cohort flag
``handle_merge_request_event`` uses — so seeding only happens for orgs that
are already opted in to GitLab code review. The downstream
``should_increment_contributor_seat`` check additionally requires
``organizations:seat-based-seer-enabled`` before any row is actually written
or a seat is assigned.

``MergeEventWebhook.WEBHOOK_EVENT_PROCESSORS`` registers this processor
**before** ``handle_merge_request_event`` so the contributor row exists when
the code-review handler's preflight billing check runs. Without that
ordering, the first MR open from a new contributor would be denied with
``ORG_CONTRIBUTOR_NOT_FOUND`` even though the same delivery seeds the row
seconds later.

Known gap: ``MergeEventWebhook.__call__`` short-circuits before ``_handle``
when the payload is missing ``last_commit`` or the author's email
(``test_merge_event_no_last_commit``). In that case this processor never
runs, so the MR author is not seeded. Tracked on SCM-99 as a follow-up.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.code_review.contributor_seats import record_contributor_action


def track_gitlab_contributor_action_processor(
    *,
    event: Mapping[str, Any],
    organization: RpcOrganization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    if integration is None:
        return

    if not features.has("organizations:seer-gitlab-support", organization):
        return

    object_attributes = event.get("object_attributes") or {}
    try:
        user_id = object_attributes["author_id"]
        user_username = event["user"]["username"]
        iid = object_attributes["iid"]
    except KeyError:
        return

    try:
        org = Organization.objects.get_from_cache(id=organization.id)
    except Organization.DoesNotExist:
        return

    record_contributor_action(
        organization=org,
        repo=repo,
        integration_id=integration.id,
        user_id=user_id,
        user_username=user_username,
        provider="gitlab",
        pr_number=iid,
        is_opened=object_attributes.get("action") == "open",
    )
