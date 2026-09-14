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


def _find_survivor(
    stale: ExternalIssue, new_key: str, *, for_update: bool = False
) -> ExternalIssue | None:
    queryset = ExternalIssue.objects.filter(
        organization_id=stale.organization_id,
        integration_id=stale.integration_id,
        key=new_key,
    ).exclude(id=stale.id)
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.first()


def _update_issue_key(stale: ExternalIssue, new_key: str, provider_issue_id: str | None) -> None:
    metadata = dict(stale.metadata or {})
    if provider_issue_id is not None:
        metadata[PROVIDER_ISSUE_ID_KEY] = str(provider_issue_id)
    stale.update(key=new_key, metadata=metadata)


def _reconcile_after_conflict(
    stale: ExternalIssue,
    old_key: str,
    new_key: str,
    provider_issue_id: str | None,
) -> tuple[bool, int | None]:
    """
    Retry a rekey after a unique-key race.

    Returns whether this delivery changed a row and the survivor id when rows were merged.
    """
    with transaction.atomic(router.db_for_write(ExternalIssue)):
        try:
            stale_after_conflict = ExternalIssue.objects.select_for_update().get(
                id=stale.id,
                organization_id=stale.organization_id,
                integration_id=stale.integration_id,
                key=old_key,
            )
        except ExternalIssue.DoesNotExist:
            return False, None

        survivor = _find_survivor(stale_after_conflict, new_key, for_update=True)
        if survivor is None:
            # The row that caused the conflict disappeared, so the rename can now succeed.
            _update_issue_key(stale_after_conflict, new_key, provider_issue_id)
            return True, None

        _merge_group_links(stale_after_conflict, survivor)
        stale_after_conflict.delete()
        return True, survivor.id


def rekey_external_issues(
    integration: Integration | RpcIntegration,
    old_key: str,
    new_key: str,
    *,
    provider_issue_id: str | None = None,
) -> int:
    """
    Follow a provider-side key rename over to `ExternalIssue`, returning the rows moved.

    Inbound lookups match on `ExternalIssue.key`, so a row left at the old key stops
    matching the issue it describes.

    `ExternalIssue` is unique on (organization, integration, key), so which row survives
    depends on what is already at `new_key`. With nothing there, the row is renamed in
    place and keeps its links. Otherwise the row already at `new_key` wins, and the
    Sentry issues linked to the old row are relinked onto it, joining any that were
    linked there already.
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
                survivor = _find_survivor(stale, new_key)

                if survivor is None:
                    _update_issue_key(stale, new_key, provider_issue_id)
                else:
                    _merge_group_links(stale, survivor)
                    stale.delete()
                    log_context["merged_into_external_issue_id"] = survivor.id
        except IntegrityError:
            # A row at the new key may have been created after the survivor lookup.
            logger.info("external_issue.rekey.conflict", extra=log_context)
            try:
                applied, survivor_id = _reconcile_after_conflict(
                    stale, old_key, new_key, provider_issue_id
                )
            except IntegrityError:
                logger.exception(
                    "external_issue.rekey.conflict_reconciliation_failed", extra=log_context
                )
                continue

            if not applied:
                logger.info("external_issue.rekey.already_applied", extra=log_context)
                continue
            if survivor_id is not None:
                log_context["merged_into_external_issue_id"] = survivor_id

        logger.info("external_issue.rekey.applied", extra=log_context)
        rekeyed += 1

    return rekeyed
