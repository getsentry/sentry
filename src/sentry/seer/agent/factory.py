from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from sentry.seer.agent.client import SeerAgentClient

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.models.group import Group
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


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
