import enum
import logging
from textwrap import dedent

import pydantic

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.artifact_schemas import RootCauseArtifact, SolutionArtifact
from sentry.seer.autofix.autofix_agent import AutofixStep, get_latest_iteration_index
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class IntrospectionAction(enum.StrEnum):
    CONTINUE = "continue"
    NEEDS_MORE_CONTEXT = "needs_more_context"
    REDO = "redo"
    NOT_ACTIONABLE = "not_actionable"


class IntrospectionDecision(pydantic.BaseModel):
    action: IntrospectionAction
    reason: str


def _extract_event_details_from_blocks(state: SeerRunState) -> str | None:
    for block in state.blocks:
        if not block.tool_results:
            continue
        for tool_result in block.tool_results:
            if tool_result is None:
                continue
            if tool_result.tool_call_function == "get_event_details" and tool_result.content:
                return tool_result.content
    return None


def _format_root_cause_section(root_cause: RootCauseArtifact) -> str:
    five_whys = "\n".join(f"  {i}. {why}" for i, why in enumerate(root_cause.five_whys, 1))
    reproduction_steps = (
        "\n".join(f"  - {step}" for step in root_cause.reproduction_steps)
        if root_cause.reproduction_steps
        else "  (none provided)"
    )
    return dedent(f"""\
        Description: {root_cause.one_line_description}

        Why chain:
        {five_whys}

        Reproduction steps:
        {reproduction_steps}\
    """)


def _format_solution_section(solution: SolutionArtifact) -> str:
    steps = "\n".join(
        f"  {i}. **{step.title}**: {step.description}" for i, step in enumerate(solution.steps, 1)
    )
    return dedent(f"""\
        Summary: {solution.one_line_summary}

        Steps:
        {steps}\
    """)


def _format_code_changes_section(diffs_by_repo: dict[str, str]) -> str:
    section = ""
    for repo, diff in diffs_by_repo.items():
        section += dedent(f"""\

            ### {repo}

            ```diff
            {diff}
            ```
        """)
    return section


def _format_event_section(event_details: str | None) -> str:
    if not event_details:
        return ""
    return dedent(f"""\

        ## Event Details

        The following is the actual event data (including stacktrace and exception info) from this issue:

        ```
        {event_details}
        ```
    """)


INTROSPECTION_SYSTEM_PROMPT = "You are a quality gate evaluating autofix outputs. Respond with JSON matching the requested schema."

INTROSPECTION_RESPONSE_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["continue", "needs_more_context", "redo", "not_actionable"],
        },
        "reason": {"type": "string"},
    },
    "required": ["action", "reason"],
}


def _run_introspection(
    run_id: int,
    step: AutofixStep,
    prompt: str,
) -> IntrospectionDecision | None:
    body = LlmGenerateRequest(
        provider="gemini",
        model="flash-lite",
        referrer=f"sentry.autofix.introspection.{step.value}",
        prompt=prompt,
        system_prompt=INTROSPECTION_SYSTEM_PROMPT,
        temperature=0.0,
        max_tokens=500,
        response_schema=INTROSPECTION_RESPONSE_SCHEMA,
        reasoning="low",
    )
    with metrics.timer("autofix.introspection", tags={"step": step.value}):
        response = make_llm_generate_request(body, timeout=30)
        if response.status >= 400:
            raise SeerApiError("Seer introspection request failed", response.status)
        data = response.json()
        content = data.get("content")
        if not content:
            logger.warning(
                "autofix.introspection.empty_response",
                extra={"run_id": run_id, "step": step.value},
            )
            return None
        return IntrospectionDecision.parse_obj(json.loads(content))


def _root_cause_introspection_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    root_cause: RootCauseArtifact,
    event_details: str | None,
) -> str:
    return dedent(f"""\
        You are evaluating whether a root cause analysis is accurate for issue {short_id}: "{title}" (culprit: {culprit}).
        {_format_event_section(event_details)}
        ## Root Cause Analysis to Evaluate

        {_format_root_cause_section(root_cause)}

        ## Your Task

        Compare the root cause analysis against the issue and event evidence above. Decide whether the analysis is accurate.

        Choose one action:

        - **continue**: The root cause accurately explains the observed error. The why chain connects the symptom shown in the stacktrace/event to a concrete code-level cause. The relevant repo is identified.

        - **needs_more_context**: The analysis is plausible but too vague to confirm. For example: the why chain stops at a high-level symptom without identifying specific code, or the relevant repo is missing when multiple repos are involved.

        - **redo**: The analysis contradicts the evidence. For example: the description does not match the stacktrace or exception, the why chain is circular or illogical, or it describes a completely different problem than what the event data shows.

        - **not_actionable**: The issue cannot be fixed through code changes. For example: it is caused by external infrastructure, third-party service outages, user misconfiguration, or expected behavior.

        Include a brief reason (1-2 sentences) explaining your decision.\
    """)


def introspect_root_cause(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    group: Group,
) -> IntrospectionDecision | None:
    try:
        root_cause = state.get_artifact("root_cause", RootCauseArtifact)
        if root_cause is None:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "root_cause",
                    "type": "root_cause",
                },
            )
            return None

        event_details = _extract_event_details_from_blocks(state)

        prompt = _root_cause_introspection_prompt(
            short_id=group.qualified_short_id or str(group.id),
            title=group.title or "",
            culprit=group.culprit or "",
            root_cause=root_cause,
            event_details=event_details,
        )

        return _run_introspection(
            run_id,
            AutofixStep.ROOT_CAUSE,
            prompt,
        )
    except Exception:
        logger.exception(
            "autofix.introspection.failed",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "step": "root_cause",
            },
        )

    return None


def _solution_introspection_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    root_cause: RootCauseArtifact,
    solution: SolutionArtifact,
    event_details: str | None,
) -> str:
    return dedent(f"""\
        You are evaluating whether a solution plan is ready for code implementation for issue {short_id}: "{title}" (culprit: {culprit}).
        {_format_event_section(event_details)}
        ## Root Cause Analysis

        {_format_root_cause_section(root_cause)}

        ## Solution Plan to Evaluate

        {_format_solution_section(solution)}

        ## Your Task

        Evaluate whether this solution plan addresses the root cause and is specific enough for a coding agent to implement.

        Choose one action:

        - **continue**: The solution directly addresses the identified root cause. Each step is specific enough that a coding agent could implement it — it identifies what to change and the approach is sound.

        - **needs_more_context**: The solution is headed in the right direction but one or more steps are too vague to implement. For example: a step says "fix the validation" without clarifying what validation logic to add or change, or "update the handler" without specifying the behavior change.

        - **redo**: The solution does not address the root cause, contradicts it, would introduce regressions, or takes an unnecessarily complex approach when a simpler fix exists.

        - **not_actionable**: The required fix cannot be implemented through code changes alone. For example: the issue is caused by a misconfigured environment variable, a third-party API limitation, or infrastructure outside the codebase.

        Include a brief reason (1-2 sentences) explaining your decision.\
    """)


def introspect_solution(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    group: Group,
) -> IntrospectionDecision | None:
    try:
        root_cause = state.get_artifact("root_cause", RootCauseArtifact)
        if root_cause is None:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "solution",
                    "type": "root_cause",
                },
            )
            return None

        solution = state.get_artifact("solution", SolutionArtifact)
        if solution is None:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "solution",
                    "type": "solution",
                },
            )
            return None

        event_details = _extract_event_details_from_blocks(state)

        prompt = _solution_introspection_prompt(
            short_id=group.qualified_short_id or str(group.id),
            title=group.title or "",
            culprit=group.culprit or "",
            root_cause=root_cause,
            solution=solution,
            event_details=event_details,
        )

        return _run_introspection(
            run_id,
            AutofixStep.SOLUTION,
            prompt,
        )
    except Exception:
        logger.exception(
            "autofix.introspection.failed",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "step": "solution",
            },
        )

    return None


def _code_changes_introspection_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    root_cause: RootCauseArtifact,
    solution: SolutionArtifact,
    diffs_by_repo: dict[str, str],
) -> str:
    return dedent(f"""\
        You are evaluating whether code changes are ready to be submitted as a pull request for issue {short_id}: "{title}" (culprit: {culprit}).

        ## Root Cause Analysis

        {_format_root_cause_section(root_cause)}

        ## Solution Plan

        {_format_solution_section(solution)}

        ## Code Changes to Evaluate
        {_format_code_changes_section(diffs_by_repo)}
        ## Your Task

        Evaluate whether the code changes correctly implement the solution plan and address the root cause.

        Choose one action:

        - **continue**: The code changes correctly implement the solution plan. The diff addresses the root cause, is minimal and focused, and does not introduce obvious bugs or regressions.

        - **needs_more_context**: The changes are incomplete — one or more steps from the solution plan are not yet implemented, or the diff is missing related changes that would be needed for the fix to work (e.g., missing import, missing migration, incomplete error handling).

        - **redo**: The changes do not implement the solution plan, introduce bugs, break existing functionality, or make unnecessary modifications unrelated to the fix.

        - **not_actionable**: The changes cannot be submitted as a pull request. For example: no actual code changes were produced, or the changes are to files that should not be modified.

        Include a brief reason (1-2 sentences) explaining your decision.\
    """)


def introspect_code_changes(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    group: Group,
) -> IntrospectionDecision | None:
    try:
        root_cause = state.get_artifact("root_cause", RootCauseArtifact)
        if root_cause is None:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "code_changes",
                    "type": "root_cause",
                },
            )
            return None

        solution = state.get_artifact("solution", SolutionArtifact)
        if solution is None:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "code_changes",
                    "type": "solution",
                },
            )
            return None

        diffs_by_repo = state.get_diffs_by_repo()
        if not diffs_by_repo:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "code_changes",
                    "type": "code_changes",
                },
            )
            return None

        diffs_by_repo_str = {
            repo: "\n".join(fp.diff for fp in patches if fp.diff)
            for repo, patches in diffs_by_repo.items()
        }

        prompt = _code_changes_introspection_prompt(
            short_id=group.qualified_short_id or str(group.id),
            title=group.title or "",
            culprit=group.culprit or "",
            root_cause=root_cause,
            solution=solution,
            diffs_by_repo=diffs_by_repo_str,
        )

        return _run_introspection(
            run_id,
            AutofixStep.CODE_CHANGES,
            prompt,
        )
    except Exception:
        logger.exception(
            "autofix.introspection.failed",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "step": "code_changes",
            },
        )

    return None


def _iteration_introspection_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    diffs_by_repo: dict[str, str],
) -> str:
    return dedent(f"""\
        You are evaluating whether pull request iteration changes are ready for issue {short_id}: "{title}" (culprit: {culprit}).

        ## Revised Code Changes to Evaluate
        {_format_code_changes_section(diffs_by_repo)}
        ## Your Task

        Evaluate whether the revised changes are suitable to update the existing pull request.

        Choose one action:

        - **continue**: The revised changes are focused, coherent, and suitable to add to the existing pull request.

        - **needs_more_context**: The revised changes are incomplete or there is not enough evidence to tell whether they address the requested iteration.

        - **redo**: The revised changes introduce obvious bugs, contradict the prior fix, or make unrelated modifications.

        - **not_actionable**: The pull request cannot be iterated through code changes. For example: no revised code changes were produced.

        Include a brief reason (1-2 sentences) explaining your decision.\
    """)


def introspect_iteration(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    group: Group,
) -> IntrospectionDecision | None:
    iteration_index = get_latest_iteration_index(state)
    try:
        diffs_by_repo = state.get_diffs_by_repo()
        if not diffs_by_repo:
            logger.warning(
                "autofix.introspection.no_artifact",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "step": "pr_iteration",
                    "type": "code_changes",
                    "iteration_index": iteration_index,
                },
            )
            return None

        diffs_by_repo_str = {
            repo: "\n".join(fp.diff for fp in patches if fp.diff)
            for repo, patches in diffs_by_repo.items()
        }

        prompt = _iteration_introspection_prompt(
            short_id=group.qualified_short_id or str(group.id),
            title=group.title or "",
            culprit=group.culprit or "",
            diffs_by_repo=diffs_by_repo_str,
        )

        return _run_introspection(
            run_id,
            AutofixStep.PR_ITERATION,
            prompt,
        )
    except Exception:
        logger.exception(
            "autofix.introspection.failed",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "step": "pr_iteration",
                "iteration_index": iteration_index,
            },
        )

    return None
