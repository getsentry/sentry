from __future__ import annotations

from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository


def resolve_base_repo_url(
    commit_comparison: CommitComparison,
    organization_id: int,
    head_repository: Repository | None = None,
) -> str | None:
    base_repo_name = commit_comparison.base_repo_name or commit_comparison.head_repo_name
    if head_repository is not None and base_repo_name == head_repository.name:
        return head_repository.url
    base_repository = Repository.objects.filter(
        organization_id=organization_id,
        name=base_repo_name,
        provider=f"integrations:{commit_comparison.provider}",
    ).first()
    # Prefer no link over a fork URL that would 404 for the base SHA.
    return base_repository.url if base_repository else None
