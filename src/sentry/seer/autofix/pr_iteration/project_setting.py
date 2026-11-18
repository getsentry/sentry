"""The project's PR iteration setting ("Auto-Iterate on PRs").

Read it only through this module. Under token-based billing the setting
defaults off, but a project option's registered default can't depend on the
org, so the registered default stays on and these readers apply the org's
default when the project never chose. A plain ``get_option`` would get that
wrong for token-billed orgs.
"""

from __future__ import annotations

from collections.abc import Sequence

from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.utils import is_seer_token_based_billing_onboarding_enabled

PR_ITERATION_OPTION = "sentry:seer_pr_iteration"


def pr_iteration_default(organization: Organization) -> bool:
    """The setting for a project that never set it.

    Under token-based billing PR iteration is opt-in, so it defaults off.
    """
    return not is_seer_token_based_billing_onboarding_enabled(organization)


def get_pr_iteration_setting(project: Project) -> bool:
    return bool(
        project.get_option(PR_ITERATION_OPTION, default=pr_iteration_default(project.organization))
    )


def get_pr_iteration_settings(
    organization: Organization, projects: Sequence[Project]
) -> dict[int, bool]:
    """``get_pr_iteration_setting`` for many projects in one org, in one query."""
    default = pr_iteration_default(organization)
    stored = ProjectOption.objects.get_value_bulk_id([p.id for p in projects], PR_ITERATION_OPTION)
    return {
        project_id: default if value is None else bool(value)
        for project_id, value in stored.items()
    }


def pr_iteration_enabled_for_group(group_id: int) -> bool:
    """Whether the group's project lets Autofix iterate on its PRs automatically.

    A missing group is not this gate's to report, so it reads as enabled and the
    caller's own lookup surfaces it.
    """
    try:
        group = Group.objects.get_from_cache(id=group_id)
    except Group.DoesNotExist:
        return True
    return get_pr_iteration_setting(group.project)
