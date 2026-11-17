from __future__ import annotations

from collections.abc import Collection
from typing import TYPE_CHECKING

from django.db.models import Exists, OuterRef, Q, QuerySet, TextField
from django.db.models.fields.json import KeyTextTransform, KeyTransform
from django.db.models.functions import Cast

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notebooks.models import Notebook, NotebookSourceType

if TYPE_CHECKING:
    from sentry.auth.access import Access, ServiceAccountAccess
    from sentry.auth.principal import RequestPrincipal

NOTEBOOKS_FEATURE = "organizations:investigations"
ISSUE_LINKS_FEATURE = "organizations:investigations-issue-links"
# Any one of these lets a member read and manage investigations.
NOTEBOOK_SCOPES = frozenset({"org:read", "org:write", "org:admin"})


def filter_visible_notebooks(notebooks: QuerySet[Notebook], access: Access) -> QuerySet[Notebook]:
    """Apply original-source project access, independently of investigation availability.

    The server-owned snapshot survives monitor and automation-history deletion. Compare
    project IDs as text so malformed JSON cannot cause a failing integer cast. Both the
    historical integer IDs and current string IDs are supported; other shapes fail closed.
    """
    projects = Project.objects.filter(
        organization_id=OuterRef("organization_id"), status=ObjectStatus.ACTIVE
    )
    if not access.has_global_access:
        projects = projects.filter(id__in=access.accessible_project_ids)
    projects = projects.annotate(source_project_id=Cast("id", TextField())).filter(
        source_project_id=KeyTextTransform(
            "id", KeyTransform("project", KeyTransform("snapshot", OuterRef("source")))
        )
    )
    return notebooks.filter(
        ~Q(source_type=NotebookSourceType.METRIC_OPEN_PERIOD)
        | (Q(source__type=NotebookSourceType.METRIC_OPEN_PERIOD) & Q(Exists(projects)))
    )


def can_view_notebook(notebook: Notebook, access: Access) -> bool:
    return filter_visible_notebooks(
        Notebook.objects.filter(id=notebook.id, organization_id=notebook.organization_id), access
    ).exists()


def has_notebooks_access(organization: Organization, actor: RequestPrincipal | None = None) -> bool:
    """Whether investigations are available to `actor` in `organization`.

    Investigations read across every project, so they also need open membership.
    """
    return features.has(NOTEBOOKS_FEATURE, organization, actor=actor) and bool(
        organization.flags.allow_joinleave
    )


def service_account_reaches(access: ServiceAccountAccess, project_ids: Collection[int]) -> bool:
    """Whether a service account can work on these projects. No projects means every project."""
    if project_ids:
        return set(project_ids).issubset(access.accessible_project_ids)
    return access.has_all_projects


def issue_links_enabled(organization: Organization, actor: RequestPrincipal | None = None) -> bool:
    """Whether investigations record, and `actor` sees, the issues they link."""
    return features.has(ISSUE_LINKS_FEATURE, organization, actor=actor) and (
        has_notebooks_access(organization, actor)
    )


def can_view_issue_links(
    organization: Organization, actor: RequestPrincipal | None, access: Access
) -> bool:
    """Issue activity only needs `event:read`; links also need the investigation scope."""
    return issue_links_enabled(organization, actor) and any(
        access.has_scope(scope) for scope in NOTEBOOK_SCOPES
    )
