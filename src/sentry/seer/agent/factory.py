"""Configured Seer agent clients for product integrations."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from sentry.seer.agent.client import SeerAgentClient

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


# Product hook modules import their callers, so load hooks only when a factory is invoked.
def create_autofix_client(
    group: Group,
    *,
    intelligence_level: Literal["low", "medium", "high"] = "medium",
    reasoning_effort: Literal["low", "medium", "high"] | None = None,
    enable_coding: bool = False,
    code_review_enabled: bool = False,
    enable_bash_tools: bool = False,
    enable_pr_context_tools: bool = False,
    user: User | RpcUser | AnonymousUser | None = None,
) -> SeerAgentClient:
    """Create a client for Autofix runs.

    Referrers describe individual runs and should be passed when dispatching them.
    """
    from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

    return SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=user,
        category_key="autofix",
        category_value=str(group.id),
        intelligence_level=intelligence_level,
        reasoning_effort=reasoning_effort,
        on_completion_hook=AutofixOnCompletionHook,
        enable_coding=enable_coding,
        code_review_enabled=code_review_enabled,
        enable_bash_tools=enable_bash_tools,
        enable_pr_context_tools=enable_pr_context_tools,
    )


def create_dashboard_generation_client(
    organization: Organization,
    user: User | RpcUser | AnonymousUser,
) -> SeerAgentClient:
    from sentry.dashboards.on_completion_hook import DashboardOnCompletionHook

    return SeerAgentClient(
        organization,
        user,
        on_completion_hook=DashboardOnCompletionHook,
        category_key="dashboard_generate",
        category_value=str(organization.id),
        reasoning_effort="medium",
    )


def create_operator_client(
    organization: Organization,
    user: User | RpcUser | None,
    *,
    category_key: str,
    category_value: str,
    enable_code_mode_tools: str = "off",
) -> SeerAgentClient:
    from sentry.seer.entrypoints.operator import SeerOperatorCompletionHook

    return SeerAgentClient(
        organization=organization,
        user=user,
        category_key=category_key,
        category_value=category_value,
        on_completion_hook=SeerOperatorCompletionHook,
        is_interactive=True,
        enable_coding=False,
        enable_code_mode_tools=enable_code_mode_tools,
        enable_embeds=False,
    )


def create_investigation_execution_client(
    organization: Organization,
    user: User | RpcUser | AnonymousUser | None,
    *,
    is_query: bool,
) -> SeerAgentClient:
    from sentry.investigations.agent import InvestigationAgentCompletionHook

    return SeerAgentClient(
        organization,
        user,
        on_completion_hook=InvestigationAgentCompletionHook,
        is_interactive=is_query,
        enable_code_mode_tools="only" if is_query else "off",
        enable_coding=False,
        enable_bash_tools=False,
        enable_embeds=is_query,
        enable_streaming=True,
        max_iterations=20 if is_query else 5,
    )


def create_investigation_title_client(
    organization: Organization,
    user: User | RpcUser | AnonymousUser | None,
) -> SeerAgentClient:
    from sentry.investigations.agent import InvestigationAgentCompletionHook

    return SeerAgentClient(
        organization,
        user,
        on_completion_hook=InvestigationAgentCompletionHook,
        enable_code_mode_tools="only",
        enable_coding=False,
        enable_bash_tools=False,
        enable_embeds=False,
        enable_streaming=True,
        max_iterations=3,
    )
