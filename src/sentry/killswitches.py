"""
Very simple "user partitioning" system used to shed load quickly from ingestion
pipeline if things go wrong. Allows for conditions based on project ID, event
type and organization ID.

This is similar to existing featureflagging systems we have, but with less
features and more performant.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Optional, Union

import click

from sentry import options
from sentry.utils import metrics

Condition = dict[str, Optional[str]]
KillswitchConfig = list[Condition]
LegacyKillswitchConfig = Union[KillswitchConfig, list[int]]
Context = dict[str, Any]


def _update_project_configs(
    old_option_value: Sequence[Mapping[str, Any]], new_option_value: Sequence[Mapping[str, Any]]
) -> None:
    """Callback for the relay.drop-transaction-metrics kill switch.
    On every change, force a recomputation of the corresponding project configs
    """
    from sentry.models.organization import Organization
    from sentry.tasks.relay import schedule_invalidate_project_config

    old_project_ids = {ctx["project_id"] for ctx in old_option_value}
    new_project_ids = {ctx["project_id"] for ctx in new_option_value}

    # We want to recompute the project config for any project that was added
    # or removed
    changed_project_ids = old_project_ids ^ new_project_ids

    if None in changed_project_ids:
        with click.progressbar(length=Organization.objects.count()) as bar:  # type: ignore[var-annotated]  # pallets/click#2630
            # Since all other invalidations, which would happen anyway, will de-duplicate
            # with these ones the extra load of this is reasonable.  A temporary backlog in
            # the relay_config_bulk queue is just fine.  We have server-side cursors
            # disabled so .iterator() fetches 50k u64's at once which is about 390kb and
            # at time of writing yields about 24 batches.
            for org_id in (
                Organization.objects.values_list("id", flat=True).all().iterator(chunk_size=50_000)
            ):
                schedule_invalidate_project_config(
                    trigger="invalidate-all", organization_id=org_id, countdown=0
                )
                bar.update(1)
    else:
        with click.progressbar(changed_project_ids) as ids:
            for project_id in ids:
                schedule_invalidate_project_config(
                    project_id=project_id, trigger="killswitches.relay.drop-transaction-metrics"
                )


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
    "relay.drop-transaction-metrics": KillswitchInfo(
        description="""
        Tell Relay via project config to stop extracting metrics from transactions.
        Note that this change will not take effect immediately, it takes time
        for downstream Relay instances to update their caches.

        If project_id is set to None, extraction will be disabled for all projects.
        In this case, the invalidation of existing project configs can take up to one hour.
        """,
        fields={
            "project_id": "project ID for which we want to stop extracting transaction metrics",
        },
        on_change=KillswitchCallback(
            _update_project_configs, "Trigger invalidation tasks for projects"
        ),
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


def killswitch_matches_context(killswitch_name: str, context: Context, emit_metrics=True) -> bool:
    assert killswitch_name in ALL_KILLSWITCH_OPTIONS
    assert set(ALL_KILLSWITCH_OPTIONS[killswitch_name].fields) == set(context)
    option_value = options.get(killswitch_name)
    rv = _value_matches(killswitch_name, option_value, context)

    if emit_metrics:
        # metrics can have a meaningful performance impact, so allow caller to opt out
        # TODO: re-evaluate after we make metric collection aysnc.
        metrics.incr(
            "killswitches.run",
            tags={"killswitch_name": killswitch_name, "decision": "matched" if rv else "passed"},
        )

    return rv


def _value_matches(
    killswitch_name: str, raw_option_value: LegacyKillswitchConfig, context: Context
) -> bool:
    option_value = normalize_value(killswitch_name, raw_option_value)

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
            return True

    return False


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
