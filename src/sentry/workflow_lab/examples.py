"""Inputs and recovery cases for the development Workflow Lab."""

from datetime import UTC, datetime, timedelta
from typing import Any


def example_input() -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "detectorId": 1,
        "projectIds": [1],
        "monitor": {
            "id": 1,
            "name": "Error count",
            "dataset": "events",
            "query": "",
            "aggregate": "count()",
            "timeWindowSeconds": 300,
        },
        "queryWindows": {
            "incident": {
                "start": (now - timedelta(minutes=20)).isoformat(),
                "end": now.isoformat(),
            },
            "baseline": {
                "start": (now - timedelta(minutes=40)).isoformat(),
                "end": (now - timedelta(minutes=20)).isoformat(),
            },
        },
        "seed": {},
    }


DEFAULT_FIXTURE = {
    "summary": "Simulated broad scan for crash recovery; no telemetry was queried.",
    "hypotheses": [
        {
            "statement": "A deployment introduced errors",
            "rationale": "Simulated hypothesis for a recovery test, not a finding.",
            "verificationSteps": [
                {
                    "title": "Check error timing",
                    "objective": "Compare errors with deployment timing.",
                    "method": "Compare error counts before and after the deployment.",
                }
            ],
        }
    ],
}
SCENARIOS = {
    "agent": {
        "label": "Live investigation",
        "description": "Run agent and direct LLM nodes through Seer’s existing runtimes.",
        "how": "Uses your workflow instructions, skills, tools, and input. This makes model calls and can incur usage costs.",
        "expect": "Each node runs after its dependencies succeed. Run state, node results, and Explorer conversations are saved in local Postgres.",
    },
    "claim": {
        "label": "Recover after a worker claims the node",
        "description": "A worker claims the saved work, then disappears before starting the agent.",
        "how": "The lab abandons the worker's claim, advances its expiry time, and runs recovery without the original caller context.",
        "expect": "The same node finishes on attempt 1, with one Explorer child and one agent invocation.",
    },
    "child_create": {
        "label": "Recover after creating the agent",
        "description": "The Explorer child is saved, but the worker stops before it can queue execution.",
        "how": "An injected exception stops startup immediately after the Explorer row is committed to Postgres.",
        "expect": "Recovery finds the saved child and queues its saved step instead of creating another child.",
    },
    "dispatch": {
        "label": "Recover when sending the task fails",
        "description": "The child exists, but its execution message never reaches the queue.",
        "how": "The lab makes the queue-publish call fail, advances the saved dispatch deadline, then runs recovery.",
        "expect": "The saved task is sent again. One child runs once on attempt 1.",
    },
    "child_link": {
        "label": "Recover before saving the agent link",
        "description": "The task was queued, but the node never saved the Explorer child ID.",
        "how": "Startup succeeds, then an injected exception stops the worker before it links the child to the node.",
        "expect": "Recovery finds the existing child using its stable start key. Duplicate messages still execute that step once.",
    },
    "result": {
        "label": "Recover before saving the result",
        "description": "The agent finished, but the workflow worker stops before saving the node's output.",
        "how": "Explorer saves the simulated response. The lab then interrupts the node's final database update.",
        "expect": "Recovery reads the saved response, validates it, and completes the node without running the agent again.",
    },
    "notification": {
        "label": "Recover a missed completion notice",
        "description": "The agent finished, but the workflow never receives its completion notification.",
        "how": "The lab drops the notification and invokes the same recovery sweep used by the backend.",
        "expect": "Recovery discovers the completed child and saves its output. No new attempt is needed.",
    },
    "duplicate": {
        "label": "Ignore duplicate tasks and stale workers",
        "description": "Two copies of the task arrive, and an old worker tries to overwrite newer state.",
        "how": "The lab delivers the same step concurrently, then tries to save a result using an expired claim.",
        "expect": "The agent is invoked once, and the old worker cannot overwrite the current node state.",
    },
    "retry": {
        "label": "Retry after an agent timeout",
        "description": "The first agent attempt fails with a timeout; the next attempt succeeds.",
        "how": "The first simulated invocation records a retryable timeout. The lab checks the saved retry delay before advancing it.",
        "expect": "Exactly two attempts and two Explorer children: one per attempt. This is an intentional retry, not a duplicate.",
    },
}

WORKFLOW_NOTES = [
    "The workflow definition is seeded into investigation_workflows for this organization. Sentry starts the registered workflow by name; editor changes are saved as a separate definition when a run starts.",
    "Supply explicit incident and baseline query windows, project IDs, and detector details. There is no legacy source formatter or input conversion.",
    "Broad scan produces 1–4 hypotheses. Each gets a generic coordinator/verifier loop. The coordinator returns LoopDecision directly: run supplies one worker input; finish supplies the evidence package. Pending and skipped checks are typed coordinator state, and settled worker history belongs to the runner.",
    "Checklist editing, selecting checks, and assembling evidence are agent responsibilities described by skills. Pydantic validates the result shape; the legacy checklist reducer, stable-ID generator, and cross-result checks are not used.",
    "The seed requires at least one settled worker execution per hypothesis and allows up to 12 coordinator rounds. It runs up to four verification loops concurrently. Judges wait for verification and evaluate each hypothesis separately; collected results preserve input order.",
    "Agent nodes use Explorer with high intelligence, 24 iterations, and read-only Code Mode; only broad scan enables bash. Coordinator and judge use the shared structured LLM client and proxy. The Lab streams Explorer activity; direct LLM responses appear when complete.",
    "A lost direct LLM worker consumes an attempt. A permitted retry can repeat a call whose response was not saved; stale responses cannot overwrite the accepted result. Cancellation discards late responses but cannot interrupt an in-flight provider request.",
    "The example uses strict map failure handling. A terminal verification-loop failure prevents judging. Maps may opt into failure_policy: collect when downstream schemas handle typed success/failure outcomes.",
    "With notebook enabled, the runner passes the completed workflow to the notebook writer. Every completed notebook gets metadata and suggested next steps in parallel. Follow-up actions, notifications, and user steering are separate work. Connected-provider credentials and organization context remain trusted runtime inputs; this Lab does not populate them. Judge recommendations to connect providers are disabled.",
]
