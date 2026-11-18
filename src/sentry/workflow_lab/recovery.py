#!/usr/bin/env python3
# ruff: noqa: E402, T201 -- configure the local environment before importing Seer.
"""Run one isolated recovery case for the Sentry Workflow Lab.

Open /workflow-lab/<org>/ on the Sentry dev server to edit and run
workflows. This CLI reads a single-node workflow, input and fixture JSON from stdin.
"""

import argparse
import json  # noqa: S003 -- runs in the Seer interpreter
import os
import re
import sys
import traceback
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event
from typing import Any
from uuid import uuid4

ROOT = Path.cwd()  # The caller selects the local Seer checkout.
sys.path.insert(0, str(ROOT / "src"))
os.chdir(ROOT)
os.environ.setdefault("DEV", "1")
from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)
# Direct Python launches don't load .envrc; use the same project as Seer's dev setup.
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "ml-ai-420606")

from examples import SCENARIOS  # noqa: TID252  -- standalone child in the Seer environment
from seer.automation.investigation_workflows.models import (
    WorkflowDefinition,
)
from seer.automation.investigation_workflows.registry import builtin_registries
from seer.context import Actor, ActorType, ViewerContext, viewer_context_scope

CHECK_COPY = {
    "Node claim is persisted": (
        "The worker's claim was saved",
        "The node row has a claim identifying the worker and when that claim expires. Another worker can recover it after expiry.",
    ),
    "Recovery sweep discovers persisted work": (
        "Recovery found the saved work",
        "The backend's recovery sweep found the due node in Postgres and requested another reconciliation pass.",
    ),
    "Database row locks are released before agent execution": (
        "The agent runs without holding database locks",
        "A separate database connection can lock the workflow, node, and child rows while the agent is running.",
    ),
    "Child dispatched before parent link was saved": (
        "The task was queued before the link was saved",
        "The Explorer child and its task exist, but explorer_run_id on the node is still empty. This is the failure gap being tested.",
    ),
    "Child generated a completion notification": (
        "The agent sent a completion notice",
        "Explorer emitted its normal completion callback. This scenario deliberately drops that notice before recovery.",
    ),
    "Retryable failure schedules a retry without incrementing the attempt yet": (
        "A retry was scheduled",
        "The timeout leaves the node ready for another attempt. Its attempt count stays at 1 until that retry actually starts.",
    ),
    "Retry backoff is persisted": (
        "The retry wait was saved in Postgres",
        "The node's next_check_at is in the future, so a restart does not erase the wait before retrying.",
    ),
    "Early redelivery cannot bypass retry backoff": (
        "An early task did not skip the retry wait",
        "Reconciliation was called before the retry deadline. It left the attempt count unchanged.",
    ),
    "Concurrent redelivery does not invoke another child": (
        "Two task deliveries ran the agent once",
        "While the first invocation was running, a second delivery of the same step was ignored.",
    ),
    "Stale worker cannot overwrite the current node state": (
        "An old worker could not overwrite newer state",
        "A save using an expired claim was rejected. The current worker kept ownership of the node.",
    ),
    "Node finishes successfully": (
        "The node finished successfully",
        "The node row in Postgres now has status succeeded.",
    ),
    "Exactly one child and one invocation per attempt": (
        "There were no duplicate agent executions",
        "The lab compares saved Explorer child IDs with its recorded agent invocations. Each attempt must have exactly one of each.",
    ),
    "Workflow completion and configured attempt limit are respected": (
        "The workflow finished within its retry limit",
        "The workflow row is succeeded, and the node's attempt count does not exceed the run's max_attempts.",
    ),
    "Recovered output passes the registered Pydantic model": (
        "The recovered response matches the output schema",
        "The saved node output equals the simulated response after validation by the registered Pydantic model, including its custom validators.",
    ),
}

PROOF_MARKER = "@@WORKFLOW_PROOF@@"


def redact_log(value):
    if isinstance(value, dict):
        sensitive = {
            "authorization",
            "cookie",
            "set-cookie",
            "api_key",
            "apikey",
            "password",
            "secret",
            "token",
            "access_token",
            "refresh_token",
            "viewer_context_jwt",
            "x-viewer-context",
        }
        return {
            key: "[redacted]" if key.lower() in sensitive else redact_log(item)
            for key, item in value.items()
        }
    if isinstance(value, (tuple, list)):
        return [redact_log(item) for item in value]
    if isinstance(value, str):
        value = re.sub(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [redacted]", value)
        return re.sub(
            r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[redacted JWT]", value
        )
    return value


def run_proof_case(case, payload, registries, viewer, *, keep_data=False):
    """Inject failures around the real runner in an isolated child process and PG schema."""
    from contextlib import ExitStack
    from unittest.mock import patch

    from seer.automation.agent.models import Message
    from seer.automation.agent_client import AgentClient
    from seer.automation.explorer.main_step import ExplorerMainStep, explorer_main_task
    from seer.automation.explorer.models import (
        Artifact,
        ExplorerBlock,
        ExplorerFailureReason,
        ExplorerStateStatus,
    )
    from seer.automation.explorer.state import ExplorerDbState
    from seer.automation.investigation_workflows import runner
    from seer.automation.investigation_workflows.runtime import WORKFLOW_RUNTIMES, WorkflowRuntime
    from seer.automation.investigation_workflows.state import NodeState
    from seer.automation.investigation_workflows.tasks import (
        reconcile_workflow_node,
        record_workflow_node_notification,
        sweep_workflow_nodes,
    )
    from seer.fastapi_only.config import get_app_config
    from seer.fastapi_only.database import db
    from seer.fastapi_only.database.db_classes import (
        Base,
        DbInvestigationWorkflow,
        DbInvestigationWorkflowUsage,
        DbRunState,
        WorkflowNodeStatus,
    )
    from seer.fastapi_only.database.db_classes import (
        DbInvestigationWorkflowNodeRun as NodeRun,
    )
    from seer.fastapi_only.database.db_classes import (
        DbInvestigationWorkflowRun as WorkflowRun,
    )
    from seer.utils import ContextAwareThreadPoolExecutor
    from sqlalchemy import create_engine, select, text
    from sqlalchemy.engine import make_url
    from sqlalchemy.schema import CreateSchema, DropSchema

    def emit(kind, **data):
        sys.stdout.write(
            PROOF_MARKER + json.dumps(redact_log({"kind": kind, **data}), default=str) + "\n"
        )
        sys.stdout.flush()

    config = get_app_config()
    database_url = make_url(config.DATABASE_URL)
    if database_url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Durability proofs require local Postgres")
    schema = "workflow_debug_" + uuid4().hex
    admin = create_engine(database_url, connect_args={"connect_timeout": 5})
    created = False
    children: list[dict[str, Any]] = []
    wakes: list[dict[str, Any]] = []
    notifications: list[dict[str, Any]] = []
    invocations: list[int] = []
    checks: list[dict[str, Any]] = []
    org = viewer.organization_id
    run_id = node_id = None
    last_checkpoint = None
    release = Event()
    entered = Event()
    concurrent = False

    class InjectedCrash(RuntimeError):
        pass

    def check(condition, label):
        title, explanation = CHECK_COPY.get(
            label, (label, "A runtime assertion checked this condition against the saved state.")
        )
        if label.startswith("Expected attempt count:"):
            count = label.rsplit(" ", 1)[-1]
            title = f"The node used {count} {'attempt' if count == '1' else 'attempts'}"
            explanation = "The node row's attempt field matches this scenario: 1 for recovery, or 2 for an intentional retry."
        checks.append({"label": title, "explanation": explanation, "passed": bool(condition)})
        emit("check", checks=checks, message=("PASS · " if condition else "FAIL · ") + title)
        if not condition:
            raise AssertionError(label)

    def node():
        with db.Session() as session:
            return session.scalars(select(NodeRun).where(NodeRun.workflow_run_id == run_id)).one()

    def checkpoint(message):
        nonlocal last_checkpoint
        current = node()
        state = NodeState.model_validate(current.state)
        with db.Session() as session:
            parent = session.get_one(WorkflowRun, run_id)
            rows = session.scalars(
                select(DbRunState).where(
                    DbRunState.value["metadata"]["workflow_node_run_id"].as_string()
                    == str(current.id)
                )
            ).all()
        child_ids = [row.id for row in rows]
        linked = current.explorer_run_id or (child_ids[-1] if child_ids else None)
        public_session = ExplorerDbState(id=linked).get().get_session() if linked else None
        session_value = public_session.model_dump(mode="json") if public_session else None
        last_checkpoint = {
            "database": database_url.database,
            "schema": schema,
            "data_retained": keep_data,
            "workflow_id": str(current.workflow_id),
            "workflow_run_id": str(run_id),
            "node_run_id": str(current.id),
            "status": current.status,
            "workflow_status": parent.status,
            "attempt": current.attempt,
            "max_attempts": parent.max_attempts,
            "explorer_run_id": current.explorer_run_id,
            "lease_token": str(current.lease_token) if current.lease_token else None,
            "lease_expires_at": current.lease_expires_at,
            "next_check_at": current.next_check_at,
            "state": state.model_dump(mode="json", exclude={"request"}),
        }
        emit(
            "checkpoint",
            message=message,
            checkpoint=last_checkpoint,
            children={
                "ids": child_ids,
                "invocations": list(invocations),
                "queued_deliveries": len(children),
            },
            session=session_value,
            explorer_run_id=linked,
        )

    def due():
        with db.Session() as session:
            current = session.get_one(NodeRun, node_id)
            current.next_check_at = datetime.now(UTC) - timedelta(seconds=1)
            if current.lease_token:
                current.lease_expires_at = current.next_check_at
            state = NodeState.model_validate(current.state)
            if state.next_dispatch_at is not None:
                state.next_dispatch_at = current.next_check_at
            current.state = state.model_dump(mode="json")
            session.commit()
        emit("event", message="Test clock: advanced recovery, lease, and dispatch deadlines")

    def reconcile():
        with viewer_context_scope(None):
            reconcile_workflow_node.run(organization_id=org, node_run_id=str(node_id))

    def recover():
        due()
        wakes.clear()
        sweep_workflow_nodes.run()
        check(
            any(item["node_run_id"] == str(node_id) for item in wakes),
            "Recovery sweep discovers persisted work",
        )
        reconcile()
        checkpoint("Recovery checked and continued the same saved node")

    def invoke(step):
        assert proof_agent.kind == "agent"
        # This is the only agent stub. Child startup, execution claims, artifacts and recovery are real.
        with db.Session() as session:
            session.execute(text("SET LOCAL lock_timeout = '2s'"))
            for model, row_id in (
                (NodeRun, node_id),
                (WorkflowRun, run_id),
                (DbRunState, step.request.run_id),
            ):
                session.execute(select(model).where(model.id == row_id).with_for_update()).one()
        check(True, "Database row locks are released before agent execution")
        invocations.append(step.request.run_id)
        emit(
            "event",
            message="Simulated agent response started",
            data={"child_id": step.request.run_id, "invocation": len(invocations)},
        )
        if concurrent:
            entered.set()
            if not release.wait(10):
                raise TimeoutError("Concurrent delivery check did not release its agent")
        failure = case == "retry" and len(invocations) == 1
        with step.context.state.update() as state:
            state.set_status(
                ExplorerStateStatus.ERROR if failure else ExplorerStateStatus.COMPLETED
            )
            state.failure_reason = ExplorerFailureReason.TIMEOUT if failure else None
            state.add_block(
                ExplorerBlock(
                    id="proof-" + uuid4().hex,
                    timestamp=datetime.now(UTC).isoformat(),
                    message=Message(
                        role="assistant",
                        content="Injected retryable timeout"
                        if failure
                        else "Deterministic proof response (no LLM call).",
                    ),
                    artifacts=[]
                    if failure
                    else [
                        Artifact(
                            key=proof_agent.artifact_key,
                            reason="Durability proof fixture",
                            data=payload["fixture"],
                        )
                    ],
                )
            )
        step._post_invoke(None)

    def deliver(request=None):
        with viewer_context_scope(None):
            explorer_main_task.run(request=request or children[-1])

    def inject(owner, method, after=True):
        original = getattr(owner, method)

        def crash(*args, **kwargs):
            if after:
                original(*args, **kwargs)
            raise InjectedCrash(case)

        with patch.object(owner, method, crash):
            try:
                reconcile()
            except InjectedCrash:
                emit("event", message="Injected crash: " + SCENARIOS[case]["label"])
            else:
                raise AssertionError("Expected crash boundary was not reached")

    try:
        with admin.begin() as connection:
            connection.execute(CreateSchema(schema))
        created = True
        scoped_url = database_url.update_query_dict({"options": f"-csearch_path={schema}"})
        db.initialize_database(
            config.model_copy(
                update={"DATABASE_URL": scoped_url.render_as_string(hide_password=False)}
            )
        )
        engine = db.get_engine()
        assert engine is not None
        Base.metadata.create_all(
            engine,
            tables=[
                Base.metadata.tables[model.__tablename__]
                for model in (
                    DbRunState,
                    DbInvestigationWorkflow,
                    WorkflowRun,
                    NodeRun,
                    DbInvestigationWorkflowUsage,
                )
            ],
        )
        emit(
            "event",
            message="Isolated Postgres schema created",
            data={"schema": schema, "agent": "stubbed", "real_llm_calls": False},
        )
        WORKFLOW_RUNTIMES["local_proof"] = WorkflowRuntime(registries=registries)
        with ExitStack() as stack, viewer_context_scope(viewer):
            stack.enter_context(
                patch.object(
                    explorer_main_task,
                    "apply_async",
                    lambda **kw: children.append(kw["kwargs"]["request"]),
                )
            )
            stack.enter_context(
                patch.object(
                    reconcile_workflow_node, "apply_async", lambda **kw: wakes.append(kw["kwargs"])
                )
            )
            stack.enter_context(
                patch.object(
                    record_workflow_node_notification,
                    "apply_async",
                    lambda **kw: notifications.append(kw["kwargs"]),
                )
            )
            stack.enter_context(patch.object(ExplorerMainStep, "invoke", invoke))
            definition = WorkflowDefinition.model_validate(payload["workflow"])
            proof_agent = next(iter(definition.nodes.values()))
            assert proof_agent.kind == "agent"
            with db.Session() as session:
                workflow = DbInvestigationWorkflow(
                    organization_id=org,
                    name=definition.name,
                    version=definition.version,
                    definition=definition.model_dump(mode="json"),
                    config={"runtime": "local_proof"},
                )
                session.add(workflow)
                session.commit()
            run_id = runner.start_investigation_run(
                workflow.id,
                input=payload["input"],
                request_id=uuid4(),
                max_attempts=2 if case == "retry" else 1,
            )
            node_id = node().id
            checkpoint("Workflow and pending work saved in Postgres")
            old = None
            if case in {"claim", "duplicate"}:
                old = runner.claim_node(org, node_id)
                check(old is not None, "Node claim is persisted")
                checkpoint("Worker stopped after claiming the node")
            elif case == "child_create":
                inject(ExplorerDbState, "new")
                checkpoint("Explorer child saved; execution was not queued")
            elif case == "dispatch":
                inject(explorer_main_task, "apply_async", after=False)
                checkpoint("Pending execution saved; sending its task failed")
            elif case == "child_link":
                inject(AgentClient, "start_chat")
                check(
                    node().explorer_run_id is None, "Child dispatched before parent link was saved"
                )
                checkpoint("Task queued; node has not saved the Explorer child ID yet")
            else:
                reconcile()
                deliver()
                checkpoint("Explorer saved the simulated response or timeout")
                if case == "result":
                    due()
                    inject(runner, "finish_claim", after=False)
                    checkpoint("Explorer has the result; the node has not saved it yet")
                elif case == "notification":
                    check(bool(notifications), "Child generated a completion notification")
                    notifications.clear()
                    emit("event", message="Dropped the completion notification")
                elif case == "retry":
                    due()
                    reconcile()
                    current = node()
                    check(
                        current.status == "ready" and current.attempt == 1,
                        "Retryable failure schedules a retry without incrementing the attempt yet",
                    )
                    check(current.next_check_at > datetime.now(UTC), "Retry backoff is persisted")
                    reconcile()
                    check(node().attempt == 1, "Early redelivery cannot bypass retry backoff")
                    checkpoint("Attempt 1 failed; attempt 2 waits for backoff")
            recover()
            if case == "duplicate":
                concurrent = True
                with ContextAwareThreadPoolExecutor(max_workers=2) as pool:
                    first = pool.submit(deliver)
                    try:
                        if not entered.wait(10):
                            first.result(timeout=1)
                            raise TimeoutError("Agent did not enter")
                        pool.submit(deliver).result(timeout=5)
                        check(
                            len(invocations) == 1,
                            "Concurrent redelivery does not invoke another child",
                        )
                        assert old is not None
                        runner.finish_claim(old, WorkflowNodeStatus.FAILED)
                        check(
                            node().status == "running",
                            "Stale worker cannot overwrite the current node state",
                        )
                    finally:
                        release.set()
                    first.result(timeout=10)
                concurrent = False
            elif case in {"claim", "child_create", "dispatch", "child_link", "retry"}:
                for request in children:
                    deliver(request)
                    deliver(request)
            notifications.clear()
            if node().status != "succeeded":
                recover()
            current = node()
            expected = 2 if case == "retry" else 1
            state = NodeState.model_validate(current.state)
            check(current.status == "succeeded", "Node finishes successfully")
            check(current.attempt == expected, f"Expected attempt count: {expected}")
            with db.Session() as session:
                ids = session.scalars(
                    select(DbRunState.id).where(
                        DbRunState.value["metadata"]["workflow_node_run_id"].as_string()
                        == str(node_id)
                    )
                ).all()
                parent = session.get_one(WorkflowRun, run_id)
            check(
                len(ids) == expected and sorted(ids) == sorted(invocations),
                "Exactly one child and one invocation per attempt",
            )
            check(
                parent.status == "succeeded" and current.attempt <= parent.max_attempts,
                "Workflow completion and configured attempt limit are respected",
            )
            agent = next(iter(definition.nodes.values()))
            assert agent.kind == "agent"
            expected_output = (
                registries.output_types[agent.output_schema]
                .model_validate(payload["fixture"])
                .model_dump(mode="json", by_alias=True)
            )
            check(
                state.output == expected_output,
                "Recovered output passes the registered Pydantic model",
            )
            checkpoint("Recovery test complete")
            result = state.output
    finally:
        release.set()
        if created:
            engine = db.get_engine()
            if engine is not None:
                engine.dispose()
            if keep_data:
                emit(
                    "event",
                    message="Proof rows kept for TablePlus",
                    data={"database": database_url.database, "schema": schema},
                )
            else:
                with admin.begin() as connection:
                    connection.execute(DropSchema(schema, cascade=True))
                emit("event", message="Temporary Postgres schema removed", data={"schema": schema})
        admin.dispose()
    emit("result", output=result, checks=checks)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--org-id", type=int, required=True)
    parser.add_argument("--user-id", type=int)
    parser.add_argument("--project-id", type=int)
    parser.add_argument(
        "--proof-case", required=True, choices=[k for k in SCENARIOS if k != "agent"]
    )
    parser.add_argument(
        "--keep-proof-data",
        action="store_true",
        help="Keep proof schemas after completion for inspection in TablePlus",
    )
    args = parser.parse_args()
    if args.org_id <= 0 or (args.user_id is not None and args.user_id <= 0):
        parser.error("Organization and user IDs must be positive")

    from sentry_options import init as init_options

    init_options()
    registries = builtin_registries()
    viewer = ViewerContext(
        actor=Actor(type=ActorType.USER, actor_id=args.user_id)
        if args.user_id
        else Actor(type=ActorType.SYSTEM),
        organization_id=args.org_id,
        project_id=args.project_id,
    )
    try:
        run_proof_case(
            args.proof_case,
            json.load(sys.stdin),
            registries,
            viewer,
            keep_data=args.keep_proof_data,
        )
    except Exception as exc:
        sys.stdout.write(
            PROOF_MARKER
            + json.dumps(
                redact_log(
                    {"kind": "error", "message": str(exc), "traceback": traceback.format_exc()}
                )
            )
            + "\n"
        )
        sys.stdout.flush()
        raise SystemExit(1) from exc
    return


if __name__ == "__main__":
    main()
