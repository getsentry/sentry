"""
Very simple "user partitioning" system used to shed load quickly from ingestion
pipeline if things go wrong. Allows for conditions based on project ID, event
type and organization ID.

This is similar to existing featureflagging systems we have, but with less
features and more performant.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Optional, Union

from sentry import options
from sentry.utils import metrics

Condition = dict[str, Optional[str]]
KillswitchConfig = list[Condition]
LegacyKillswitchConfig = Union[KillswitchConfig, list[int]]
Context = dict[str, Any]


@dataclass
class KillswitchCallback:
    """Named callback to run after a kill switch has been pushed."""

    callback: Callable[[Any, Any], None]
    #: `title` will be presented in the user prompt when asked whether or not to run the callback
    title: str

    def __call__(self, old: Any, new: Any) -> None:
        self.callback(old, new)


@dataclass
class KillswitchInfo:
    description: str
    fields: dict[str, str]
    on_change: KillswitchCallback | None = None


ALL_KILLSWITCH_OPTIONS = {
    "store.load-shed-group-creation-projects": KillswitchInfo(
        description="Drop event in save_event before entering transaction to create group",
        fields={
            "project_id": "A project ID to filter events by.",
            "platform": "The event platform as defined in the event payload's platform field.",
        },
    ),
    "store.load-shed-pipeline-projects": KillswitchInfo(
        description="Drop event in ingest consumer. Available fields are severely restricted because nothing is parsed yet.",
        fields={
            "project_id": "A project ID to filter events by.",
            "event_id": "An event ID as given in the event payload.",
            "has_attachments": "Filter events by whether they have been sent together with attachments or not. Note that attachments can be sent completely separately as well.",
        },
    ),
    "store.load-shed-parsed-pipeline-projects": KillswitchInfo(
        description="Drop events in ingest consumer after parsing them. Available fields are more but a bunch of stuff can go wrong before that.",
        fields={
            "organization_id": "Numeric organization ID to filter events by.",
            "project_id": "A project ID to filter events by.",
            "event_type": "transaction, csp, hpkp, expectct, expectstaple, transaction, default or null",
            "has_attachments": "Filter events by whether they have been sent together with attachments or not. Note that attachments can be sent completely separately as well.",
            "event_id": "An event ID as given in the event payload.",
        },
    ),
    "store.load-shed-process-event-projects": KillswitchInfo(
        description="Skip event process_event and forward to save_event",
        fields={
            "project_id": "A project ID to filter events by.",
            "event_id": "An event ID as given in the event payload.",
            "platform": "The event platform as defined in the event payload's platform field.",
        },
    ),
    "store.load-shed-symbolicate-event-projects": KillswitchInfo(
        description="Skip symbolicating events in symbolicate_event (event gets fwd to process_event)",
        fields={
            "project_id": "A project ID to filter events by.",
            "event_id": "An event ID as given in the event payload.",
            "platform": "The event platform as defined in the event payload's platform field.",
            "symbolication_function": "process_minidump, process_applecrashreport, process_native_stacktraces, or process_js_stacktraces",
        },
    ),
    "store.load-shed-save-event-projects": KillswitchInfo(
        description="Drop events in save_event",
        fields={
            "project_id": "A project ID to filter events by.",
            "event_type": "transaction, csp, hpkp, expectct, expectstaple, transaction, default or null",
            "platform": "The event platform as defined in the event payload's platform field, or 'none'",
        },
    ),
    "post_process.get-autoassign-owners": KillswitchInfo(
        description="""
        Prevent project from running ProjectOwnership._matching_ownership_rules.

        In case project has too many ownership rules, spike of events from that
        project can cause post_process tasks backlog.
        """,
        fields={
            "project_id": "A project ID to filter events by.",
        },
    ),
    "post_process.disable-pipeline-steps": KillswitchInfo(
        description="""
        Skip individual steps of the post_process_group pipeline.

        `pipeline_step` is the name of the step function as it appears in
        GROUP_CATEGORY_POST_PROCESS_PIPELINE / GENERIC_POST_PROCESS_PIPELINE,
        e.g. `kick_off_seer_automation`. Leaving it unset is a wildcard that
        disables *every* step, i.e. all of post-processing.

        The same step function runs in more than one pipeline (e.g.
        process_snoozes runs for both error and feedback issues). Set
        `issue_category` to target only one of them.

        Work skipped this way is dropped for good, nothing catches up when the
        switch is turned off again.
        """,
        fields={
            "pipeline_step": "Name of the post-process step function, e.g. kick_off_seer_automation.",
            "project_id": "A project ID to filter events by.",
            "organization_id": "An organization ID to filter events by.",
            "issue_category": "Lowercased GroupCategory name, e.g. error or feedback.",
        },
    ),
    "reprocessing2.drop-delete-old-primary-hash": KillswitchInfo(
        description="""
        Drop per-event messages emitted from delete_old_primary_hash. This message is currently lacking batching, and for the time being we should be able to drop it on a whim.

        Side-effect is that events appear in Discover that are
        supposed to be deleted. They have no valid group_id so
        they're hidden in issuestream.
        """,
        fields={"project_id": "A project ID to filter those messages by."},
    ),
    "kafka.send-project-events-to-random-partitions": KillswitchInfo(
        description="""
        Send error messages from a project to random partitions, to avoid overloading a single partition
        """,
        fields={
            "project_id": "project ID to randomly assign partitions for event messages",
            "message_type": "message type to randomly partition",
        },
    ),
    "api.organization.disable-last-deploys": KillswitchInfo(
        description="""
        Do not retrieve last deploys for projects in organization.

        To protect database against suboptimal queries for organizations with huge number of
        projects. This works by adding collapse argument to the serializer.
        """,
        fields={"organization_id": "An organization ID to disable last deploys for."},
    ),
    "crons.organization.disable-check-in": KillswitchInfo(
        description="""
        Do not consumer monitor check-ins for a specific organization.

        This is valuable in scenarios where a organization is slamming in
        progress check-ins without actually marking the check-in as complete
        for whatever reason. This can cuase extranious strain on the system.
        """,
        fields={"organization_id": "An organization ID to disable check-ins for."},
    ),
    "seer.similarity.grouping_killswitch_projects": KillswitchInfo(
        description="""
        Prevent project from using LLM embeddings for grouping new hashes.
        In case project has too many new events, spike of events from that
        project can cause seer to be overloaded or ingestion to slow down.
        """,
        fields={
            "project_id": "A project ID to filter events by.",
        },
    ),
    "issues.severity.skip-seer-requests": KillswitchInfo(
        description="""
        Do not make requests to Seer.

        This is intended as a hard stop on making calls to Seer where Seer
        may be broken and otherwise causing interruptions or delays to ingestion.
        Skipping the dependencies on Seer should remove it from the critical path.
        """,
        fields={
            "project_id": "A project ID to filter events by.",
        },
    ),
    "spans.drop-in-buffer": KillswitchInfo(
        description="""
        Drop spans.
        """,
        fields={
            "org_id": "An org ID to filter spans by.",
            "project_id": "A project ID.",
            "trace_id": "A trace ID.",
            "partition_id": "A kafka partition index.",
        },
    ),
    "profiling.killswitch.ingest-profiles": KillswitchInfo(
        description="""
        Drop profiles in the sentry.profiles.task.process_profile_from_kafka and
        sentry.profiles.task.process_profile_from_kafka_raw tasks.

        This happens after relay produces profiles to the topic but before a task
        is started to process/ingest to profile.
        """,
        fields={
            "project_id": "A project ID.",
        },
    ),
    "spans.process-segments.drop-segments": KillswitchInfo(
        description="""
        Drop segments in the process-segments consumer based on organization ID.

        This allows shedding load quickly if a particular organization is generating
        excessive segments.
        """,
        fields={
            "org_id": "An organization ID to filter segments by.",
        },
    ),
    "deletions.nodestore.killswitch-projects": KillswitchInfo(
        description="""
        Halt the self-chaining nodestore group-event deletion task for the given projects.

        Note that this leaves partial cleanup: remaining nodestore, eventstore, and EAP
        data will not be deleted and must be cleaned up manually.
        """,
        fields={
            "project_id": "A project ID to halt nodestore group-event deletion for.",
        },
    ),
    "unmerge.killswitch-projects": KillswitchInfo(
        description="""
        Halt the self-chaining unmerge task for the given projects.

        Note that this will orphan any events that havne't been moved to the new group.
        """,
        fields={
            "project_id": "A project ID to halt unmerge for.",
        },
    ),
    "merge.killswitch-projects": KillswitchInfo(
        description="""
        Halt the self-chaining merge_groups task for the given projects.

        Note that this leaves a partial merge: groups already processed stay merged,
        and the rest remain in PENDING_MERGE.
        """,
        fields={
            "project_id": "A project ID to halt merge for.",
        },
    ),
    "hybridcloud.webhookpayload.shed-inbound": KillswitchInfo(
        description="""
        Drop inbound integration webhooks before a WebhookPayload row is written.

        Break glass for an inbound flood: matching senders get a 429 with a
        Retry-After instead of having their webhook queued, so the flood stops
        costing the control primary payload INSERTs and push triggers.

        Every condition must name a `provider`; leaving `integration_id` unset sheds
        that whole provider. A condition without a `provider` would match every one
        of them, so it is ignored rather than honoured.

        Shed webhooks are gone unless the sender redelivers them.
        """,
        fields={
            "provider": "An integration provider slug, e.g. github or jira.",
            "integration_id": "An integration ID, to shed a single integration.",
        },
    ),
}


def validate_user_input(killswitch_name: str, option_value: Any) -> KillswitchConfig:
    return normalize_value(killswitch_name, option_value, strict=True)


def normalize_value(
    killswitch_name: str, option_value: Any, strict: bool = False
) -> KillswitchConfig:
    rv: KillswitchConfig = []
    for i, condition in enumerate(option_value or ()):
        if isinstance(condition, int):
            # legacy format
            condition = {"project_id": str(condition)}

        for k in ALL_KILLSWITCH_OPTIONS[killswitch_name].fields:
            if k not in condition:
                if strict:
                    raise ValueError(f"Condition {i}: Missing field {k}")
                else:
                    condition[k] = None

        if strict:
            for k in list(condition):
                if k not in ALL_KILLSWITCH_OPTIONS[killswitch_name].fields:
                    raise ValueError(f"Condition {i}: Unknown field: {k}")

        rv.append({k: str(v) if v is not None else None for k, v in condition.items()})

    return rv


def get_killswitch_value(killswitch_name: str) -> KillswitchConfig:
    assert killswitch_name in ALL_KILLSWITCH_OPTIONS
    raw_option_value = options.get(killswitch_name)
    return normalize_value(killswitch_name, raw_option_value)


def killswitch_matches_context(killswitch_name: str, context: Context, emit_metrics=True) -> bool:
    option_value = get_killswitch_value(killswitch_name)
    assert set(ALL_KILLSWITCH_OPTIONS[killswitch_name].fields) == set(context)
    return value_matches(killswitch_name, option_value, context, emit_metrics)


def value_matches(
    killswitch_name: str,
    option_value: KillswitchConfig,
    context: Context,
    emit_metrics=True,
) -> bool:
    decision = False
    for condition in option_value:
        for field, matching_value in condition.items():
            if matching_value is None:
                continue

            value = context.get(field)
            if value is None:
                break

            if str(value) != matching_value:
                break
        else:
            decision = True
            break

    if emit_metrics or decision:
        # metrics can have a meaningful performance impact, so allow caller to opt out
        # TODO: re-evaluate after we make metric collection aysnc.
        metrics.incr(
            "killswitches.run",
            tags={
                "killswitch_name": killswitch_name,
                "decision": "matched" if decision else "passed",
            },
        )

    return decision


def print_conditions(killswitch_name: str, raw_option_value: LegacyKillswitchConfig) -> str:
    option_value = normalize_value(killswitch_name, raw_option_value)
    if not option_value:
        return "<disabled entirely>"

    return "DROP DATA WHERE\n  " + " OR\n  ".join(
        "("
        + " AND ".join(
            f"{field} = {matching_value if matching_value is not None else '*'}"
            for field, matching_value in condition.items()
        )
        + ")"
        for condition in option_value
    )
