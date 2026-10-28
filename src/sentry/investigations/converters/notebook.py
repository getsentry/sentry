from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from django.db import router, transaction
from django.db.models import Max

from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockKind,
    InvestigationSourceType,
)
from sentry.investigations.services.investigations import bump_investigation_version
from sentry.models.organization import Organization


@dataclass(frozen=True)
class IssueRef:
    group_id: int
    short_id: str
    title: str


@dataclass(frozen=True)
class BlockSpec:
    # Unique within the notebook. A converter that runs again for the same
    # notebook updates the block with this key instead of adding a new one.
    key: str
    kind: InvestigationBlockKind
    title: str
    config: dict[str, Any]


@dataclass(frozen=True)
class ConvertedNotebook:
    source_type: InvestigationSourceType
    source_key: str
    title: str
    source: dict[str, Any]
    blocks: Sequence[BlockSpec] = field(default_factory=tuple)


def write_converted_notebook(
    *, organization: Organization, notebook: ConvertedNotebook
) -> Investigation:
    """Create the notebook on first write, then add or update its blocks by key."""
    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation, created = Investigation.objects.select_for_update().get_or_create(
            organization=organization,
            source_type=notebook.source_type,
            source_key=notebook.source_key,
            source_revision=1,
            defaults={
                "title": notebook.title,
                "source": notebook.source,
                "source_ref": notebook.source,
            },
        )
        # Engine blocks carry a report_revision; converter blocks never do.
        existing = {
            block.stable_agent_key: block
            for block in InvestigationBlock.objects.select_for_update().filter(
                investigation=investigation,
                report_revision__isnull=True,
                stable_agent_key__isnull=False,
                deleted_at__isnull=True,
            )
        }
        position = InvestigationBlock.objects.filter(investigation=investigation).aggregate(
            maximum=Max("position")
        )["maximum"]
        next_position = 0 if position is None else position + 1

        changed = created
        for spec in notebook.blocks:
            block = existing.get(spec.key)
            if block is None:
                InvestigationBlock.objects.create(
                    investigation=investigation,
                    position=next_position,
                    kind=spec.kind,
                    title=spec.title,
                    config=spec.config,
                    stable_agent_key=spec.key,
                )
                next_position += 1
                changed = True
            elif (block.kind, block.title, block.config) != (spec.kind, spec.title, spec.config):
                # Update in place so comments on the block stay attached.
                block.kind = spec.kind
                block.title = spec.title
                block.config = spec.config
                block.version += 1
                block.save()
                changed = True

        if changed and not created:
            bump_investigation_version(investigation)
    return investigation
