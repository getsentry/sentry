from __future__ import annotations

import calendar
import datetime
import logging
import time
from urllib.parse import urlparse

from rest_framework.response import Response

from sentry import features, options, quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.utils import jwt

logger = logging.getLogger(__name__)


def get_jwt(github_id: str | None = None, github_private_key: str | None = None) -> str:
    if github_id is None:
        github_id = options.get("github-app.id")
    if github_private_key is None:
        github_private_key = options.get("github-app.private-key")
    exp_ = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    exp = calendar.timegm(exp_.timetuple())
    # Generate the JWT
    payload = {
        # issued at time
        "iat": int(time.time()),
        # JWT expiration time (10 minute maximum)
        "exp": exp,
        # Integration's GitHub identifier
        "iss": github_id,
    }
    return jwt.encode(payload, github_private_key, algorithm="RS256")


def get_next_link(response: Response) -> str | None:
    """Github uses a `link` header to inform pagination.
    The relation parameter can be prev, next, first or last

    Read more here:
    https://docs.github.com/en/rest/guides/using-pagination-in-the-rest-api?apiVersion=2022-11-28#using-link-headers
    """
    link_option: str | None = response.headers.get("link")
    if link_option is None:
        return None

    # Should be a comma separated string of links
    links = link_option.split(",")

    for link in links:
        # If there is a 'next' link return the URL between the angle brackets, or None
        if 'rel="next"' in link:
            start = link.find("<") + 1
            end = link.find(">")
            return link[start:end]

    return None


def parse_github_blob_url(repo_url: str, source_url: str) -> tuple[str, str]:
    """
    Parse a GitHub blob URL relative to a repository URL and return
    a tuple of (branch, source_path).

    Handles minor differences (for example, trailing slashes) by
    normalizing paths and stripping the repo path prefix before
    splitting on '/blob/'. If parsing fails, returns ("", "").
    """
    repo_path = urlparse(repo_url).path.rstrip("/")
    parsed = urlparse(source_url)
    path = parsed.path
    if repo_path and path.startswith(repo_path):
        path = path[len(repo_path) :]

    _, _, after_blob = path.partition("/blob/")
    if not after_blob:
        return "", ""

    branch, _, remainder = after_blob.partition("/")
    return branch, remainder.lstrip("/")


def _is_code_review_enabled_for_repo(repository_id: int) -> bool:
    """Check if code review is explicitly enabled for this repository."""
    return RepositorySettings.objects.filter(
        repository_id=repository_id,
        enabled_code_review=True,
    ).exists()


def _is_autofix_enabled_for_repo(organization_id: int, repository_id: int) -> bool:
    """
    Check if autofix automation is enabled (not "off") for any project
    associated with this repository via code mappings.
    """
    repo_configs = RepositoryProjectPathConfig.objects.filter(
        repository_id=repository_id,
        organization_id=organization_id,
    ).values_list("project_id", flat=True)

    if not repo_configs:
        return False

    return (
        ProjectOption.objects.filter(
            project_id__in=repo_configs,
            project__status=ObjectStatus.ACTIVE,
            key="sentry:autofix_automation_tuning",
        )
        .exclude(value=AutofixAutomationTuningSettings.OFF.value)
        .exclude(value__isnull=True)
        .exists()
    )


def _has_code_review_or_autofix_enabled(organization_id: int, repository_id: int) -> bool:
    """
    Check if either code review is enabled for the repo OR autofix automation
    is enabled for any linked project.
    """
    return _is_code_review_enabled_for_repo(repository_id) or _is_autofix_enabled_for_repo(
        organization_id, repository_id
    )


def should_create_or_increment_contributor_seat(
    organization: Organization, repo: Repository, contributor: OrganizationContributors
) -> bool:
    """
    Guard for OrganizationContributor creation/incrementing and seat assignment.

    Determines if we should create or increment an OrganizationContributor record
    and potentially assign a new seat.

    Logic:
    1. Require seat-based Seer to be enabled for the organization
    2. Exclude organizations in code-review-beta cohort (they use a different flow)
    3. Require code review OR autofix to be enabled for the repo
    4. Check Seer quota (returns True if contributor has seat OR quota available)
    """
    if not features.has("organizations:seat-based-seer-enabled", organization):
        return False

    if features.has("organizations:code-review-beta", organization):
        return False

    if not _has_code_review_or_autofix_enabled(organization.id, repo.id):
        return False

    if repo.integration_id is None:
        return False

    return quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_USER,
        seat_object=contributor,
    )
