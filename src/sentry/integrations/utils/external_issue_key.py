from __future__ import annotations

import logging

from django.db import IntegrityError, router, transaction

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.grouplink import GroupLink

logger = logging.getLogger(__name__)

# `ExternalIssue.key` holds the provider's human-readable key, and some providers change it
# out from under us: Jira reassigns an issue's key when the issue moves to another project.
# Where the provider also exposes an id that never changes, we stash it under this key in
# `ExternalIssue.metadata` so a link stays identifiable even if we miss the rename.
PROVIDER_ISSUE_ID_KEY = "provider_issue_id"


def _merge_group_links(stale: ExternalIssue, survivor: ExternalIssue) -> None:
    """
    Point the stale row's group links at `survivor`, dropping the ones that would duplicate.

    `GroupLink` is unique on (group, linked_type, linked_id), so a group already linked to
    `survivor` can't also be repointed at it — that link is redundant and gets dropped.
    """
    stale_links = GroupLink.objects.filter(
        linked_type=GroupLink.LinkedType.issue, linked_id=stale.id
    )
    already_linked = set(
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.issue, linked_id=survivor.id
        ).values_list("group_id", flat=True)
    )

    stale_links.exclude(group_id__in=already_linked).update(linked_id=survivor.id)
    # Whatever still points at the stale row is a duplicate of a link `survivor` already has.
    stale_links.delete()


def rekey_external_issues(
    integration: Integration | RpcIntegration,
    old_key: str,
    new_key: str,
    *,
    provider_issue_id: str | None = None,
) -> int:
    """
    Follow a provider-side key rename over to `ExternalIssue`, returning the rows moved.

    Every inbound lookup — status sync, assignee sync, the provider-side "linked issues"
    panels — matches on `ExternalIssue.key`, so a row left at the old key silently stops
    matching the issue it describes.

    `ExternalIssue` is unique on (organization, integration, key), so an organization that
    already has a row at `new_key` (someone linked the issue again under its new key) is
    merged into rather than renamed over.
    """
    if old_key == new_key:
        return 0

    stale_issues = list(ExternalIssue.objects.get_for_integration(integration, old_key))
    rekeyed = 0

    for stale in stale_issues:
        log_context = {
            "integration_id": integration.id,
            "organization_id": stale.organization_id,
            "external_issue_id": stale.id,
            "old_key": old_key,
            "new_key": new_key,
        }
        try:
            with transaction.atomic(router.db_for_write(ExternalIssue)):
                survivor = (
                    ExternalIssue.objects.filter(
                        organization_id=stale.organization_id,
                        integration_id=stale.integration_id,
                        key=new_key,
                    )
                    .exclude(id=stale.id)
                    .first()
                )

                if survivor is None:
                    metadata = dict(stale.metadata or {})
                    if provider_issue_id is not None:
                        metadata[PROVIDER_ISSUE_ID_KEY] = str(provider_issue_id)
                    stale.update(key=new_key, metadata=metadata)
                else:
                    _merge_group_links(stale, survivor)
                    stale.delete()
                    log_context["merged_into_external_issue_id"] = survivor.id
        except IntegrityError:
            # A concurrent delivery of the same rename got there first.
            logger.warning("external_issue.rekey.conflict", extra=log_context, exc_info=True)
            continue

        logger.info("external_issue.rekey.applied", extra=log_context)
        rekeyed += 1

    return rekeyed
