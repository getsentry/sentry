from typing import Any
from urllib.parse import urlparse

from sentry.types.cell import Cell as Cell
from sentry.types.cell import CellResolutionError as CellResolutionError
from sentry.types.cell import get_cell_by_name as get_cell_by_name

from .db import pgq_from_djq


def cell_for_organization_query(org_id_or_slug: str) -> tuple[str, Any]:
    from sentry.models.organizationmapping import OrganizationMapping

    if org_id_or_slug.isdecimal():
        qs = OrganizationMapping.objects.filter(organization_id=org_id_or_slug).values("cell_name")
    else:
        qs = OrganizationMapping.objects.filter(slug=org_id_or_slug).values("cell_name")
    qs.query.set_limits(0, 1)
    q, qp = qs.query.sql_with_params()
    q = pgq_from_djq(q, len(qp))
    return q, qp


async def get_cell_for_organization(db: Any, org_id_or_slug: str) -> Cell:
    q, qp = cell_for_organization_query(org_id_or_slug)
    cell_name = await db.fetchval(q, *qp)
    if not cell_name:
        raise CellResolutionError(f"Organization {org_id_or_slug} has no associated mapping.")
    return get_cell_by_name(cell_name)


def get_cell_from_dsn(dsn: str, fallback: str) -> Cell:
    try:
        url = urlparse(dsn)
    except Exception:
        raise ValueError

    host_segments = url.netloc.split(".")
    if (len(host_segments) - 2) < 3:
        # If we don't have a o123.ingest.{cell}.{app_host} style domain
        # we fallback to default
        return get_cell_by_name(fallback)

    try:
        cell_segment = host_segments[-3]
        return get_cell_by_name(cell_segment)
    except Exception:
        raise CellResolutionError(f"DSN {dsn} has no associated cell.")
