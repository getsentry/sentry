from sentry.types.cell import Cell, CellResolutionError, get_cell_by_name

from .db import pgq_from_djq


async def get_cell_for_organization(db, org_id_or_slug: str) -> Cell:
    from sentry.models.organizationmapping import OrganizationMapping

    if org_id_or_slug.isdecimal():
        qs = OrganizationMapping.objects.filter(organization_id=org_id_or_slug).values("cell_name")
    else:
        qs = OrganizationMapping.objects.filter(slug=org_id_or_slug).values("cell_name")
    qs.query.set_limits(0, 1)
    q, qp = qs.query.sql_with_params()
    q = pgq_from_djq(q, len(qp))
    cell_name = await db.fetchval(q, *qp)
    if not cell_name:
        raise CellResolutionError(f"Organization {org_id_or_slug} has no associated mapping.")
    return get_cell_by_name(cell_name)
