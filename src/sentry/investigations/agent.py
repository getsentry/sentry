from __future__ import annotations

import ast
import html
import logging
import re
from datetime import datetime
from enum import StrEnum
from functools import partial
from typing import Any

from django.db import router, transaction
from django.db.models import F
from django.utils import timezone
from urllib3.exceptions import HTTPError

from sentry.investigations.contracts import validate_query_result, validate_text_result
from sentry.investigations.models import (
    TERMINAL_BLOCK_EXECUTION_STATUSES,
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
    InvestigationStatus,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.executions import mark_block_execution_dispatched
from sentry.investigations.services.investigations import (
    DEFAULT_INVESTIGATION_TITLE,
    investigation_source,
    mark_downstream_blocks_stale,
)
from sentry.investigations.telemetry import (
    record_execution_cancelled,
    record_execution_completed,
    record_execution_failed,
    record_execution_started,
    record_investigation_completed,
    record_investigation_failed,
    record_title_generation_completed,
    record_title_generation_failed,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_models import MemoryBlock, SeerRunState
from sentry.seer.agent.client_utils import AgentUpdateRequest, make_agent_update_request
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.users.services.user.service import user_service
from sentry.utils import json

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_BYTES = 1024 * 1024
MAX_TOOL_CONTENT_CHARS = 100_000
MAX_QUERY_LINK_PARAM_CHARS = 2000
IMPORT_NOT_ALLOWED_ERROR = "This import is not allowed in an investigation query."
PRIVATE_TRANSCRIPT_KEYS = {
    "authorization",
    "credentials",
    "headers",
    "metadata",
    "secret",
    "signature",
    "token",
}


class TitleGenerationStatus(StrEnum):
    """Values stored in `Investigation.title_generation_status`."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


IN_FLIGHT_TITLE_STATUSES = (TitleGenerationStatus.PENDING, TitleGenerationStatus.RUNNING)
NON_RETRYABLE_TITLE_STATUSES = (
    *IN_FLIGHT_TITLE_STATUSES,
    TitleGenerationStatus.COMPLETED,
    TitleGenerationStatus.FAILED,
)

TITLE_WORD_LIMIT = 5
SUMMARY_MIN_WORDS = 1
SUMMARY_WORD_LIMIT = 10
SUMMARY_DESCRIPTION_MAX_CHARS = 2000
TITLE_PREVIEW_PATTERN = re.compile(r'"title"\s*:\s*"((?:\\.|[^"\\])*)')

ACTIVE_BLOCK_EXECUTION_STATUSES = (
    InvestigationBlockExecutionStatus.PENDING,
    InvestigationBlockExecutionStatus.RUNNING,
    InvestigationBlockExecutionStatus.AWAITING_INPUT,
    InvestigationBlockExecutionStatus.STOPPING,
)


QUERY_INSTRUCTIONS = """You are answering a query block inside a Sentry investigation.
Use Code Mode only for telemetry analysis. You may call sentry.telemetry_live_search and
sentry.render_chart, combine multiple telemetry results, and perform local read-only data
transformations. Do not call any other Sentry API and never mutate data. Restrict every
telemetry call to the supplied project slugs. Every sentry.telemetry_live_search call must
pass project_slugs as a literal list of string values in the call itself, for example
project_slugs=["project-one", "project-two"]. Never build that argument from a variable,
loop variable, comprehension, or other expression; write separate calls when different literal
project lists are needed. Do not import sentry, sentry_sdk, or tool input types; use the provided
sentry object directly. For a time-series chart, call sentry.render_chart with a title and series shaped like
[{"label": "Errors", "data": [{"x": "2026-08-04T00:00:00+00:00", "y": 1}]}],
for example title="Error volume", subtitle="Last 24 hours | 1,240 total events",
x_axis="time", y_axis_unit="number", and a supported visualization such as "line". Always give
the chart a concise title and a subtitle containing the most useful result metadata, such as the
time window, scope, and total count. Pass chart points and series as inline plain dictionaries; do not
import type helpers. Time-axis
x values must be offset-bearing ISO 8601 timestamps. If the question cannot be answered with telemetry, ask the user an
inline clarification. Finish by returning exactly one raw JSON object in your final response.
The source object in investigation_context is authoritative resolved source context, not a
template parameter. Use source.snapshot for supplied monitor, project, threshold, condition,
dataset, and analysis-window facts; do not report them missing merely because parameters is empty.
When notebookContext contains an item with currentBlock=true, it is the last successful result for
the block being refined. Reuse its table and chart data for presentation-only requests such as
changing line, area, or bar visualization; do not claim the data is unavailable or query it again.
The first character must be { and the last character must be }.
Do not wrap the object in a Markdown code fence or include prose before or after it. Do not call any function to
write or save the result. tableMarkdown must be a complete Markdown table (or an empty table). When
render_chart returns a chart embed, put its chart body JSON object directly in the chart field
and rename each series label to name. Keep every telemetry_live_search return object reachable
in the Code Mode call's returned value so Sentry can retain its exact query link. Do not copy
telemetry links or any other metadata into the final response. The final object must contain
exactly these five keys and no others: tableMarkdown, chart, preferredView, isEmpty, and
chartUnavailableReason. preferredView must be exactly
table or chart. Do not put explanatory prose in tableMarkdown.
"""

TEXT_INSTRUCTIONS = """Rewrite the current investigation text block as useful Markdown using
only the supplied notebook context. Be brief by default: aim for two or three short paragraphs,
using a compact list or small table only when it materially improves clarity. Do not produce a
long report unless the request explicitly requires one. Do not use tools or embeds. Return the
complete replacement Markdown directly in your final response. Do not call any function to write
or save it.
"""


def build_agent_prompt(execution: InvestigationBlockExecution) -> str:
    snapshot = execution.input_snapshot
    instruction = (
        QUERY_INSTRUCTIONS
        if execution.block.kind == InvestigationBlockKind.QUERY
        else TEXT_INSTRUCTIONS
    )
    context = {
        "request": snapshot.get("prompt"),
        "organizationSlug": snapshot.get("organizationSlug"),
        "source": snapshot.get("source", {}),
        "projectSlugs": snapshot.get("projectSlugs", []),
        "filters": snapshot.get("filters", {}),
        "parameters": snapshot.get("parameters", {}),
        "notebookContext": snapshot.get("context", []),
        "datasetHint": snapshot.get("datasetHint"),
    }
    return (
        f"{instruction}\n<investigation_context>\n{json.dumps(context)}\n</investigation_context>"
    )


def start_execution_run(
    execution: InvestigationBlockExecution,
    organization: Organization,
    user: Any,
    client: SeerAgentClient | None = None,
    dispatch_claimed_at: datetime | None = None,
) -> None:
    is_query = execution.block.kind == InvestigationBlockKind.QUERY
    if client is None:
        client = SeerAgentClient(organization, user)
    client.on_completion_hook = InvestigationAgentCompletionHook
    client.is_interactive = is_query
    client.enable_code_mode_tools = "only" if is_query else "off"
    client.enable_coding = False
    client.enable_bash_tools = False
    client.enable_embeds = is_query
    client.enable_streaming = True
    client.max_iterations = 20 if is_query else 5
    dispatch_won: bool | None = None

    def mark_dispatched(run: Any) -> None:
        nonlocal dispatch_won
        dispatch_won = mark_block_execution_dispatched(
            execution, seer_run_id=run.id, dispatch_claimed_at=dispatch_claimed_at
        )

    run = client.start_run(
        build_agent_prompt(execution),
        metadata={
            "referrer": "investigation-block",
            "investigation_id": str(execution.block.investigation.id),
            "block_id": str(execution.block.id),
            "execution_id": str(execution.id),
        },
        record_in_history=False,
        on_run_created=mark_dispatched,
    )
    if dispatch_won is True:
        record_execution_started(execution)
    if dispatch_won is False and run.seer_run_state_id is not None:
        _interrupt_execution_best_effort(organization, run.seer_run_state_id)


def _block_policy_error(
    block: MemoryBlock,
    *,
    allow_query_tools: bool,
    allowed_project_slugs: set[str] | None = None,
) -> str | None:
    for call in block.message.tool_calls or []:
        if call.function == "sentry_api_search":
            if allow_query_tools:
                continue
            return "Tools are not allowed for this block."
        if call.function != "sentry_api_execute":
            return f"Unsupported tool call: {call.function}."
        if not allow_query_tools:
            return "Tools are not allowed for this block."
        try:
            args = json.loads(call.args)
        except (TypeError, ValueError):
            args = None
        if not isinstance(args, dict):
            return "The Code Mode call had invalid arguments."
        policy_error = _code_policy_error(
            str(args.get("code", "")),
            allow_query_tools=allow_query_tools,
            allowed_project_slugs=allowed_project_slugs,
        )
        if policy_error is not None and not _code_mode_lint_prevented_execution(block, call.id):
            return policy_error
    return None


def _code_mode_lint_prevented_execution(block: MemoryBlock, tool_call_id: str | None) -> bool:
    """A Code Mode lint failure is proof that the submitted code never ran."""
    if tool_call_id is None:
        return False
    for result in block.tool_results or []:
        if (
            result is not None
            and result.tool_call_id == tool_call_id
            and result.tool_call_function == "sentry_api_execute"
            and "Lint errors (code not executed):" in (result.content or "")
        ):
            return True
    return False


def _telemetry_project_slugs(call: ast.Call) -> list[str] | None:
    value: ast.AST | None = None
    for keyword in call.keywords:
        if keyword.arg == "project_slugs":
            value = keyword.value
            break
    if value is None and len(call.args) >= 3:
        value = call.args[2]
    if value is None:
        return None
    try:
        project_slugs = ast.literal_eval(value)
    except (TypeError, ValueError, SyntaxError):
        return None
    if not isinstance(project_slugs, list) or any(
        not isinstance(slug, str) for slug in project_slugs
    ):
        return None
    return project_slugs


def _code_policy_error(
    code: str,
    *,
    allow_query_tools: bool,
    allowed_project_slugs: set[str] | None = None,
) -> str | None:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return "The Code Mode call contained invalid Python."
    allowed = {"telemetry_live_search", "render_chart"} if allow_query_tools else set()
    allowed_imports = {
        "collections",
        "datetime",
        "decimal",
        "functools",
        "itertools",
        "json",
        "math",
        "numpy",
        "pandas",
        "statistics",
    }
    blocked_calls = {
        "__import__",
        "compile",
        "delattr",
        "eval",
        "exec",
        "getattr",
        "open",
        "setattr",
    }
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    used: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name.split(".", 1)[0] not in allowed_imports for alias in node.names):
                return IMPORT_NOT_ALLOWED_ERROR
        if isinstance(node, ast.ImportFrom):
            if node.module is None or node.module.split(".", 1)[0] not in allowed_imports:
                return IMPORT_NOT_ALLOWED_ERROR
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in blocked_calls
        ):
            return f"The {node.func.id} function is not allowed in an investigation query."
        if not isinstance(node, ast.Name) or node.id != "sentry":
            continue
        attribute = parents.get(node)
        call = parents.get(attribute) if isinstance(attribute, ast.Attribute) else None
        if (
            not isinstance(attribute, ast.Attribute)
            or attribute.value is not node
            or not isinstance(call, ast.Call)
            or call.func is not attribute
        ):
            return "Dynamic or aliased access to the Sentry API is unsupported."
        used.add(attribute.attr)
    unsupported = sorted(used - allowed)
    if unsupported:
        return (
            "Unsupported Sentry API call: "
            + ", ".join(f"sentry.{function}" for function in unsupported)
            + "."
        )
    if allowed_project_slugs is not None:
        for node in ast.walk(tree):
            if not (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "sentry"
                and node.func.attr == "telemetry_live_search"
            ):
                continue
            project_slugs = _telemetry_project_slugs(node)
            if not project_slugs:
                return "Telemetry calls must use a non-empty literal project_slugs list."
            if not set(project_slugs).issubset(allowed_project_slugs):
                return "The telemetry call requested a project outside this investigation."
    return None


def _sanitize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[hidden]" if key.lower() in PRIVATE_TRANSCRIPT_KEYS else _sanitize_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    return value


def sanitize_state(
    state: SeerRunState,
    *,
    allow_query_tools: bool = True,
    allowed_project_slugs: set[str] | None = None,
) -> tuple[list[dict[str, Any]], bool, bool]:
    blocks: list[dict[str, Any]] = []
    off_policy = False
    for block in state.blocks:
        policy_error = _block_policy_error(
            block,
            allow_query_tools=allow_query_tools,
            allowed_project_slugs=allowed_project_slugs,
        )
        off_policy = off_policy or policy_error is not None
        message = _sanitize_value(block.message.dict(exclude={"thinking_content", "metadata"}))
        item: dict[str, Any] = {
            "id": block.id,
            "timestamp": block.timestamp,
            "loading": block.loading,
            "message": message,
            "artifacts": [_sanitize_value(artifact.dict()) for artifact in block.artifacts],
            "toolLinks": [
                _sanitize_value(link.dict()) if link else None for link in block.tool_links or []
            ],
            "toolResults": [],
        }
        if policy_error is not None:
            item["policyError"] = policy_error
        for result in block.tool_results or []:
            if result is None:
                item["toolResults"].append(None)
                continue
            value = _sanitize_value(result.dict())
            if policy_error is not None:
                value["content"] = f"[Result hidden: {policy_error}]"
                value["structuredContent"] = None
            elif value.get("content") and len(value["content"]) > MAX_TOOL_CONTENT_CHARS:
                value["content"] = value["content"][:MAX_TOOL_CONTENT_CHARS] + "\n[truncated]"
            item["toolResults"].append(value)
        if not (block.loading and state.status not in {"processing", "awaiting_user_input"}):
            blocks.append(item)

    truncated = False
    while len(json.dumps(blocks).encode()) > MAX_TRANSCRIPT_BYTES and blocks:
        truncated = True
        removed = False
        for transcript_block in blocks:
            for result in transcript_block.get("toolResults", []):
                if isinstance(result, dict) and result.get("content") not in {None, "[truncated]"}:
                    result["content"] = "[truncated]"
                    result["structuredContent"] = None
                    removed = True
                    break
            if removed:
                break
        if not removed:
            blocks.pop(0)
    return blocks, truncated, off_policy


def _result_payload(content: str | None) -> Any:
    if not content:
        return None
    opening = '<UNTRUSTED_DATA source="sentry_api"'
    start = content.find(opening)
    if start < 0:
        return None
    start = content.find(">", start + len(opening))
    if start < 0:
        return None
    end = content.find("</UNTRUSTED_DATA>", start + 1)
    if end < 0:
        return None
    try:
        return ast.literal_eval(html.unescape(content[start + 1 : end].strip()))
    except (SyntaxError, TypeError, ValueError):
        return None


def _telemetry_links_from_payload(value: Any) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    if isinstance(value, dict):
        link_params = value.get("link_params")
        if isinstance(link_params, dict):
            links.append({"kind": "telemetry", "params": link_params})
        for item in value.values():
            links.extend(_telemetry_links_from_payload(item))
    elif isinstance(value, list | tuple):
        for item in value:
            links.extend(_telemetry_links_from_payload(item))
    return links


def _project_slugs_from_code(code: str) -> set[str]:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return set()
    slugs: set[str] = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "sentry"
            and node.func.attr == "telemetry_live_search"
        ):
            slugs.update(_telemetry_project_slugs(node) or [])
    return slugs


def _sanitized_query_link(link: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    for key, value in (link.get("params") or {}).items():
        if isinstance(value, str):
            params[str(key)] = value[:MAX_QUERY_LINK_PARAM_CHARS]
        elif isinstance(value, bool | int | float) or value is None:
            params[str(key)] = value
        elif isinstance(value, list | tuple) and all(
            item is None or isinstance(item, str | bool | int | float) for item in value
        ):
            params[str(key)] = [
                item[:MAX_QUERY_LINK_PARAM_CHARS] if isinstance(item, str) else item
                for item in value
            ]
    kind = link.get("kind")
    return {"kind": kind if isinstance(kind, str) else "telemetry", "params": params}


def _successful_links_and_projects(
    state: SeerRunState, organization: Organization
) -> tuple[list[dict[str, Any]], list[Project]]:
    links: list[dict[str, Any]] = []
    seen_links: set[str] = set()
    slugs: set[str] = set()
    organization_wide = False
    for block in state.blocks:
        raw_links: list[dict[str, Any]] = [
            link.dict() for link in block.tool_links or [] if link is not None
        ]
        for result in block.tool_results or []:
            if result is None:
                continue
            if result.structuredContent is not None:
                structured_links = result.structuredContent.get("links")
                if isinstance(structured_links, list):
                    raw_links.extend(link for link in structured_links if isinstance(link, dict))
            raw_links.extend(_telemetry_links_from_payload(_result_payload(result.content)))
        has_successful_telemetry = False
        for link in raw_links:
            params = link.get("params")
            if not isinstance(params, dict) or params.get("is_error"):
                continue
            project_slugs = params.get("project_slugs") or params.get("projectSlugs") or []
            if isinstance(project_slugs, str):
                project_slugs = [project_slugs]
            if project_slugs:
                slugs.update(str(slug) for slug in project_slugs)
            if "dataset" in params or "query" in params:
                has_successful_telemetry = True
                sanitized = _sanitized_query_link(link)
                key = json.dumps(sanitized, sort_keys=True)
                if key not in seen_links:
                    seen_links.add(key)
                    links.append(sanitized)
                organization_wide = organization_wide or not project_slugs
        if has_successful_telemetry:
            for call in block.message.tool_calls or []:
                if call.function != "sentry_api_execute":
                    continue
                try:
                    args = json.loads(call.args)
                except (TypeError, ValueError):
                    args = None
                if not isinstance(args, dict):
                    continue
                slugs.update(_project_slugs_from_code(str(args.get("code", ""))))
    projects = list(
        Project.objects.filter(organization=organization)
        if organization_wide
        else Project.objects.filter(organization=organization, slug__in=slugs)
    )
    return links, projects


def _normalize_chart(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    chart = dict(value)
    series = chart.get("series")
    if isinstance(series, list):
        chart["series"] = [
            {**item, "name": item.get("name", item.get("label"))}
            if isinstance(item, dict)
            else item
            for item in series
        ]
        for item in chart["series"]:
            if isinstance(item, dict):
                item.pop("label", None)
    return chart


def _result_from_final_message(state: SeerRunState, *, block_kind: str) -> dict[str, Any] | None:
    for block in reversed(state.blocks):
        if block.message.role != "assistant" or not block.message.content:
            continue
        content = block.message.content
        if block_kind == InvestigationBlockKind.TEXT:
            return {"schemaVersion": 1, "markdown": content}
        try:
            candidate = json.loads(content)
        except (TypeError, ValueError):
            return None
        required_fields = {
            "tableMarkdown",
            "chart",
            "preferredView",
            "isEmpty",
            "chartUnavailableReason",
        }
        if not isinstance(candidate, dict) or set(candidate) != required_fields:
            return None
        if (
            not isinstance(candidate["tableMarkdown"], str)
            or (candidate["chart"] is not None and not isinstance(candidate["chart"], dict))
            or candidate["preferredView"] not in {"table", "chart"}
            or not isinstance(candidate["isEmpty"], bool)
            or (
                candidate["chartUnavailableReason"] is not None
                and not isinstance(candidate["chartUnavailableReason"], str)
            )
        ):
            return None
        return {
            "schemaVersion": 1,
            "tableMarkdown": candidate["tableMarkdown"],
            "chart": _normalize_chart(candidate.get("chart")),
            "preferredView": candidate["preferredView"],
            "isEmpty": candidate["isEmpty"],
            "chartUnavailableReason": candidate["chartUnavailableReason"],
        }
    return None


def _interrupt_execution_best_effort(organization: Organization, run_id: int) -> None:
    try:
        interrupt_run(organization, run_id)
    except (HTTPError, RuntimeError):
        logger.exception(
            "investigations.execution.cancel_after_failure_interrupt_failed",
            extra={"seer_run_state_id": run_id},
        )


def cancel_investigation_executions_after_failure(
    failed_execution: InvestigationBlockExecution,
) -> None:
    database = router.db_for_write(InvestigationBlockExecution)
    with transaction.atomic(using=database):
        investigation = (
            Investigation.objects.select_for_update()
            .select_related("organization")
            .get(id=failed_execution.block.investigation_id)
        )
        failed_execution = (
            InvestigationBlockExecution.objects.select_for_update(of=("self",))
            .select_related("block")
            .get(id=failed_execution.id)
        )
        if (
            failed_execution.status != InvestigationBlockExecutionStatus.FAILED
            or failed_execution.block.current_execution_id != failed_execution.id
            or failed_execution.block.version != failed_execution.block_version
        ):
            return

        failure_reason = str((failed_execution.error or {}).get("code") or "execution_failed")
        transaction.on_commit(
            partial(record_investigation_failed, investigation, reason=failure_reason),
            using=database,
        )

        active_executions = list(
            InvestigationBlockExecution.objects.select_for_update(of=("self",))
            .filter(
                block__investigation_id=investigation.id,
                status__in=ACTIVE_BLOCK_EXECUTION_STATUSES,
            )
            .exclude(id=failed_execution.id)
            .select_related("block__investigation", "seer_run")
            .order_by("id")
        )
        completed_at = timezone.now()
        error = {
            "code": "investigation_execution_failed",
            "message": "Cancelled because another cell in this investigation failed.",
        }
        for execution in active_executions:
            execution.status = InvestigationBlockExecutionStatus.CANCELLED
            execution.error = error
            execution.completed_at = completed_at
        InvestigationBlockExecution.objects.bulk_update(
            active_executions, ["status", "error", "completed_at"]
        )

        for execution in active_executions:
            transaction.on_commit(
                partial(
                    record_execution_cancelled,
                    execution,
                    reason="investigation_execution_failed",
                ),
                using=database,
            )
            if execution.seer_run is None or execution.seer_run.seer_run_state_id is None:
                continue
            transaction.on_commit(
                partial(
                    _interrupt_execution_best_effort,
                    investigation.organization,
                    execution.seer_run.seer_run_state_id,
                ),
                using=database,
            )


def _cancel_investigation_executions_after_commit(
    failed_execution: InvestigationBlockExecution,
) -> None:
    transaction.on_commit(
        partial(cancel_investigation_executions_after_failure, failed_execution),
        using=router.db_for_write(InvestigationBlockExecution),
    )


def synchronize_execution(execution: InvestigationBlockExecution, state: SeerRunState) -> None:
    # The branches below each guard their own writes against a terminal status, except the
    # off-policy one, which acts on the Seer state alone. Without this a late off-policy run
    # would overwrite a cancelled execution with a failure the user did not cause.
    if execution.status in TERMINAL_BLOCK_EXECUTION_STATUSES:
        return
    blocks, transcript_truncated, off_policy = sanitize_state(
        state,
        allow_query_tools=execution.block.kind == InvestigationBlockKind.QUERY,
        allowed_project_slugs=set(execution.input_snapshot.get("projectSlugs", [])),
    )
    pending_import_lint = off_policy and all(
        block.get("policyError") == IMPORT_NOT_ALLOWED_ERROR and not block.get("toolResults")
        for block in blocks
        if block.get("policyError")
    )
    if (
        off_policy
        and not pending_import_lint
        and state.status
        in {
            "processing",
            "awaiting_user_input",
        }
    ):
        blocks = [block for block in blocks if not block.get("loading")]
        policy_error = next(
            (str(block["policyError"]) for block in blocks if block.get("policyError")),
            "The agent attempted an unsupported operation.",
        )
        database = router.db_for_write(InvestigationBlockExecution)
        with transaction.atomic(using=database):
            completed_at = timezone.now()
            updated = (
                InvestigationBlockExecution.objects.filter(id=execution.id)
                .exclude(status__in=TERMINAL_BLOCK_EXECUTION_STATUSES)
                .update(
                    status=InvestigationBlockExecutionStatus.FAILED,
                    transcript=blocks,
                    transcript_truncated=transcript_truncated,
                    error={
                        "code": "unsupported_tool_use",
                        "message": policy_error,
                    },
                    completed_at=completed_at,
                )
            )
            if not updated:
                return
            execution.completed_at = completed_at
            transaction.on_commit(
                partial(
                    record_execution_failed,
                    execution,
                    reason="unsupported_tool_use",
                    seer_run_id=state.run_id,
                ),
                using=database,
            )
            _cancel_investigation_executions_after_commit(execution)
            if execution.seer_run and execution.seer_run.seer_run_state_id:
                transaction.on_commit(
                    partial(
                        _interrupt_execution_best_effort,
                        execution.block.investigation.organization,
                        execution.seer_run.seer_run_state_id,
                    ),
                    using=database,
                )
        return
    status = {
        "processing": InvestigationBlockExecutionStatus.RUNNING,
        "awaiting_user_input": InvestigationBlockExecutionStatus.AWAITING_INPUT,
    }.get(state.status)
    if status:
        updated = (
            InvestigationBlockExecution.objects.filter(id=execution.id)
            .exclude(status__in=TERMINAL_BLOCK_EXECUTION_STATUSES)
            .update(status=status, transcript=blocks, transcript_truncated=transcript_truncated)
        )
        if updated:
            execution.status = status
            execution.transcript = blocks
            execution.transcript_truncated = transcript_truncated
        return

    database = router.db_for_write(InvestigationBlockExecution)
    with transaction.atomic(using=database):
        execution = (
            InvestigationBlockExecution.objects.select_for_update()
            .select_related("block__investigation")
            .get(id=execution.id)
        )
        if execution.status in TERMINAL_BLOCK_EXECUTION_STATUSES:
            return
        execution.transcript = blocks
        execution.transcript_truncated = transcript_truncated
        execution.completed_at = timezone.now()
        if state.status == "error" or off_policy:
            policy_error = next(
                (str(block["policyError"]) for block in blocks if block.get("policyError")),
                "The agent attempted an unsupported operation.",
            )
            execution.status = InvestigationBlockExecutionStatus.FAILED
            execution.error = {
                "code": "unsupported_tool_use" if off_policy else "seer_execution_failed",
                "message": policy_error if off_policy else "The agent run failed.",
            }
            execution.save()
            transaction.on_commit(
                partial(
                    record_execution_failed,
                    execution,
                    reason=execution.error["code"],
                    seer_run_id=state.run_id,
                ),
                using=database,
            )
            _cancel_investigation_executions_after_commit(execution)
            return

        raw_result = _result_from_final_message(state, block_kind=execution.block.kind)
        if raw_result is None:
            execution.status = InvestigationBlockExecutionStatus.FAILED
            final_content = next(
                (
                    block.message.content
                    for block in reversed(state.blocks)
                    if block.message.role == "assistant" and block.message.content
                ),
                None,
            )
            if final_content is None:
                execution.error = {
                    "code": "missing_result",
                    "message": "The run returned no final result.",
                }
            else:
                execution.error = {
                    "code": "invalid_result",
                    "message": "The agent returned malformed or unsupported result JSON.",
                }
            execution.save()
            transaction.on_commit(
                partial(
                    record_execution_failed,
                    execution,
                    reason=execution.error["code"],
                    seer_run_id=state.run_id,
                ),
                using=database,
            )
            _cancel_investigation_executions_after_commit(execution)
            return
        try:
            if execution.block.kind == InvestigationBlockKind.QUERY:
                result = dict(raw_result)
                result["chart"] = _normalize_chart(result.get("chart"))
                links, projects = _successful_links_and_projects(
                    state, execution.block.investigation.organization
                )
                result["queryLinks"] = links
                result = validate_query_result(result)
                allowed_project_ids = set(execution.input_snapshot.get("projectIds", []))
                queried_project_ids = {project.id for project in projects}
                if not queried_project_ids.issubset(allowed_project_ids):
                    raise ValueError("The result queried outside the investigation project scope.")
                result_project_ids = queried_project_ids.union(
                    execution.input_snapshot.get("contextDataProjectIds", [])
                )
                projects = list(
                    Project.objects.filter(
                        organization=execution.block.investigation.organization,
                        id__in=result_project_ids,
                    ).order_by("id")
                )
            else:
                context_project_ids = execution.input_snapshot.get("contextDataProjectIds", [])
                projects = list(
                    Project.objects.filter(
                        organization=execution.block.investigation.organization,
                        id__in=context_project_ids,
                    ).order_by("id")
                )
                result = validate_text_result(raw_result)
        except Exception as error:
            execution.status = InvestigationBlockExecutionStatus.FAILED
            execution.error = {"code": "invalid_result", "message": str(error)[:1000]}
            execution.save()
            transaction.on_commit(
                partial(
                    record_execution_failed,
                    execution,
                    reason="invalid_result",
                    seer_run_id=state.run_id,
                ),
                using=database,
            )
            _cancel_investigation_executions_after_commit(execution)
            return

        execution.result = result
        execution.status = InvestigationBlockExecutionStatus.COMPLETED
        execution.error = None
        execution.save()
        transaction.on_commit(partial(record_execution_completed, execution), using=database)
        InvestigationBlockExecutionProject.objects.bulk_create(
            [InvestigationBlockExecutionProject(execution=execution, project=p) for p in projects],
            ignore_conflicts=True,
        )
        block = (
            InvestigationBlock.objects.select_for_update()
            .select_related("investigation")
            .get(id=execution.block_id)
        )
        if block.current_execution_id != execution.id or block.version != execution.block_version:
            return
        if block.deleted_at is not None or block.investigation.status != InvestigationStatus.ACTIVE:
            return
        if block.kind == InvestigationBlockKind.QUERY:
            block.result_execution = execution
            block.stale_at = None
            block.save(update_fields=["result_execution", "stale_at", "date_updated"])
        else:
            markdown = result["markdown"]
            block.content = markdown
            block.generated_content = markdown
            block.content_execution = execution
            block.stale_at = None
            block.version += 1
            block.save()
        mark_downstream_blocks_stale(
            investigation_id=block.investigation_id, upstream_block_ids={block.id}
        )
        transaction.on_commit(
            lambda: _maybe_start_title_generation(block.investigation, execution.triggered_by_id),
            using=database,
        )
        if execution.triggered_by_id is not None:
            transaction.on_commit(
                partial(
                    schedule_eligible_auto_run_blocks,
                    investigation_id=block.investigation_id,
                    user_id=execution.triggered_by_id,
                ),
                using=database,
            )


def _maybe_start_title_generation(investigation: Investigation, user_id: int | None) -> None:
    if investigation.title_generation_status in NON_RETRYABLE_TITLE_STATUSES:
        return
    blocks = list(
        investigation.blocks.filter(deleted_at__isnull=True)
        .select_related("content_execution", "result_execution")
        .order_by("position")
    )
    auto_run_blocks = [block for block in blocks if block.config.get("autoRun")]
    if not auto_run_blocks and investigation.title != DEFAULT_INVESTIGATION_TITLE:
        return
    if auto_run_blocks and not all(_block_has_current_result(block) for block in auto_run_blocks):
        return
    if investigation.summary is not None and investigation.summary_description is not None:
        return
    user = user_service.get_user(user_id=user_id) if user_id else None
    client = SeerAgentClient(
        investigation.organization,
        user,
        on_completion_hook=InvestigationAgentCompletionHook,
        enable_code_mode_tools="only",
        enable_coding=False,
        enable_bash_tools=False,
        enable_embeds=False,
        enable_streaming=True,
        max_iterations=3,
    )
    block_context = "\n".join(_completion_block_context(block) for block in blocks)
    prompt = (
        "Describe a completed Sentry investigation. Do not use tools. Return exactly one raw JSON "
        "object with the keys title, summary, and summary_description and no other text. title "
        "must identify the incident in at most 5 words. summary must state what happened in at "
        "most 10 words. summary_description must use casual, plain language in 1 or 2 short "
        "newline-separated sentences: lead with the strongest evidence and optionally add the most "
        "useful next step. Avoid headings and jargon. Distinguish established facts from hypotheses "
        "and do not invent a cause. Put title "
        "first in the JSON object. Do not call any function to write or save the result.\n"
        "<source_context>\n"
        f"{json.dumps(investigation_source(investigation))}\n</source_context>\n"
        f"<block_context>\n{block_context}\n</block_context>"
    )

    database = router.db_for_write(Investigation)
    with transaction.atomic(using=database):
        locked = Investigation.objects.select_for_update().get(id=investigation.id)
        if locked.title_generation_status in NON_RETRYABLE_TITLE_STATUSES or (
            locked.summary is not None and locked.summary_description is not None
        ):
            return
        locked.update(title_generation_status=TitleGenerationStatus.PENDING)

    title_seer_run_state_id: int | None = None

    def link_title_run(run: Any) -> None:
        nonlocal title_seer_run_state_id
        title_seer_run_state_id = run.seer_run_state_id
        Investigation.objects.filter(id=investigation.id).update(
            title_seer_run_id=run.id, title_generation_status=TitleGenerationStatus.RUNNING
        )

    try:
        client.start_run(
            prompt,
            metadata={
                "referrer": "investigation-title",
                "investigation_id": str(investigation.id),
            },
            record_in_history=False,
            on_run_created=link_title_run,
        )
    except Exception:
        Investigation.objects.filter(
            id=investigation.id, title_generation_status__in=IN_FLIGHT_TITLE_STATUSES
        ).update(title_generation_status=TitleGenerationStatus.FAILED)
        record_title_generation_failed(
            investigation,
            reason="dispatch_failed",
            seer_run_id=title_seer_run_state_id,
        )
        raise


def synchronize_title(investigation: Investigation, state: SeerRunState) -> None:
    if investigation.title_generation_status not in IN_FLIGHT_TITLE_STATUSES:
        return
    if any(
        _block_policy_error(block, allow_query_tools=False) is not None for block in state.blocks
    ):
        if state.status in {"processing", "awaiting_user_input"}:
            interrupt_run(investigation.organization, state.run_id)
        investigation.update(title_generation_status=TitleGenerationStatus.FAILED)
        record_title_generation_failed(
            investigation, reason="unsupported_tool_use", seer_run_id=state.run_id
        )
        return
    if state.status in {"processing", "awaiting_user_input"}:
        return
    content = next(
        (
            block.message.content
            for block in reversed(state.blocks)
            if block.message.role == "assistant" and block.message.content
        ),
        "",
    )
    metadata = _parse_completion_metadata(content)
    updates: dict[str, Any] = {
        "title_generation_status": (
            TitleGenerationStatus.COMPLETED if metadata else TitleGenerationStatus.FAILED
        )
    }
    if metadata:
        if investigation.title == DEFAULT_INVESTIGATION_TITLE:
            updates["title"] = metadata["title"]
        updates["summary"] = metadata["summary"]
        updates["summary_description"] = metadata["summary_description"]
        updates["version"] = F("version") + 1
    investigation.update(**updates)
    if metadata is not None:
        record_title_generation_completed(investigation)
        record_investigation_completed(investigation)
    else:
        record_title_generation_failed(
            investigation,
            reason="seer_execution_failed"
            if state.status == "error"
            else ("missing_result" if not content else "invalid_result"),
            seer_run_id=state.run_id,
        )


def _block_has_current_result(block: InvestigationBlock) -> bool:
    execution = (
        block.result_execution
        if block.kind == InvestigationBlockKind.QUERY
        else block.content_execution
    )
    return (
        execution is not None
        and execution.status == InvestigationBlockExecutionStatus.COMPLETED
        and block.stale_at is None
    )


def _completion_block_context(block: InvestigationBlock) -> str:
    if block.kind == InvestigationBlockKind.QUERY and block.result_execution is not None:
        output = json.dumps(block.result_execution.result)
    else:
        output = block.content
    return f"- {block.title}\n  Request: {block.prompt[:1000]}\n  Result: {output[:4000]}"


def _parse_completion_metadata(content: str) -> dict[str, str] | None:
    content = _strip_json_code_fence(content)
    try:
        payload = json.loads(content)
    except ValueError:
        return None
    required_keys = {
        "title",
        "summary",
        "summary_description",
    }
    if not isinstance(payload, dict) or not required_keys.issubset(payload):
        return None
    if not all(isinstance(payload[key], str) for key in required_keys):
        return None
    title = " ".join(payload["title"].split())
    summary = " ".join(payload["summary"].split())
    description_lines = [
        " ".join(line.split())
        for line in payload["summary_description"].splitlines()
        if line.strip()
    ]
    if not (
        1 <= len(title.split()) <= TITLE_WORD_LIMIT
        and SUMMARY_MIN_WORDS <= len(summary.split()) <= SUMMARY_WORD_LIMIT
        and 1 <= len(description_lines) <= 3
    ):
        return None
    summary_description = "\n".join(description_lines)
    if len(summary_description) > SUMMARY_DESCRIPTION_MAX_CHARS:
        return None
    return {
        "title": title[:255],
        "summary": summary[:255],
        "summary_description": summary_description,
    }


def _strip_json_code_fence(content: str) -> str:
    stripped = content.strip()
    lines = stripped.splitlines()
    if (
        len(lines) >= 3
        and lines[0].strip().lower() in {"```", "```json"}
        and lines[-1].strip() == "```"
    ):
        return "\n".join(lines[1:-1]).strip()
    return stripped


def title_generation_preview(content: str | None) -> str | None:
    if not content:
        return None
    metadata = _parse_completion_metadata(content)
    if metadata is not None:
        return metadata["title"]
    match = TITLE_PREVIEW_PATTERN.search(content)
    if match is None:
        return None
    partial_title = match.group(1).replace(r"\"", '"').replace(r"\\", "\\")
    words = partial_title.split()
    return " ".join(words[:TITLE_WORD_LIMIT]) or None


def interrupt_run(organization: Organization, run_id: int) -> None:
    response = make_agent_update_request(
        AgentUpdateRequest(
            run_id=run_id, organization_id=organization.id, payload={"type": "interrupt"}
        )
    )
    if response.status >= 400:
        raise RuntimeError("Unable to stop the agent run")


class InvestigationAgentCompletionHook(AgentOnCompletionHook):
    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        state = SeerAgentClient(organization, None).get_run(run_id)
        execution = InvestigationBlockExecution.objects.filter(
            seer_run__seer_run_state_id=run_id,
            block__investigation__organization=organization,
        ).first()
        if execution is not None:
            synchronize_execution(execution, state)
            return
        investigation = Investigation.objects.filter(
            organization=organization, title_seer_run__seer_run_state_id=run_id
        ).first()
        if investigation is not None:
            synchronize_title(investigation, state)
