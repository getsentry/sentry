from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from functools import reduce
from typing import Any

from django.db import router, transaction
from django.db.models.base import Model

from sentry import analytics, similarity, tsdb
from sentry.analytics.events.eventuser_endpoint_request import EventUserEndpointRequest
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS_MAP
from sentry.culprit import generate_culprit
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.eventattachment import EventAttachment
from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.grouprelease import GroupRelease
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.userreport import UserReport
from sentry.services import eventstore
from sentry.services.eventstore.models import GroupEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.tsdb.base import TSDBModel
from sentry.types.activity import ActivityType
from sentry.unmerge import InitialUnmergeArgs, SuccessiveUnmergeArgs, UnmergeArgs, UnmergeArgsBase
from sentry.utils.eventuser import EventUser
from sentry.utils.query import task_run_batch_query

logger = logging.getLogger(__name__)


def cache(function: Callable[..., Any]) -> Callable[..., Any]:
    results: dict[tuple[int, ...], tuple[bool, type[Model] | Exception | None]] = {}

    def fetch(*key: Any) -> Any:
        value = results.get(key)
        if value is None:
            try:
                value = results[key] = (True, function(*key))
            except Exception as error:
                value = results[key] = (False, error)

        ok, result = value
        if ok:
            return result
        else:
            assert isinstance(result, Exception)
            raise result

    return fetch


def get_caches() -> dict[str, Callable[..., Any]]:
    return {
        "Environment": cache(
            lambda organization_id, name: Environment.objects.get(
                organization_id=organization_id, name=name
            )
        ),
        "GroupRelease": cache(
            lambda group_id, environment, release_id: GroupRelease.objects.get(
                group_id=group_id, environment=environment, release_id=release_id
            )
        ),
        "Project": cache(lambda id: Project.objects.get(id=id)),
        "Release": cache(
            lambda organization_id, version: Release.objects.get(
                organization_id=organization_id, version=version
            )
        ),
    }


def merge_mappings(values: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for value in values:
        result.update(value)
    return result


initial_fields = {
    "culprit": lambda event, group: generate_culprit(event.data),
    "data": lambda event, group: {
        "last_received": event.data.get("received") or float(event.datetime.strftime("%s")),
        "type": event.data["type"],
        "metadata": event.data["metadata"],
    },
    "last_seen": lambda event, group: event.datetime,
    "level": lambda event, group: LOG_LEVELS_MAP.get(event.get_tag("level"), logging.ERROR),
    "message": lambda event, group: event.search_message,
    "times_seen": lambda event, group: 0,
    "status": lambda event, group: group.status,
    "substatus": lambda event, group: group.substatus,
}


backfill_fields = {
    "platform": lambda caches, data, event: event.platform,
    "logger": lambda caches, data, event: event.get_tag("logger") or DEFAULT_LOGGER_NAME,
    "first_seen": lambda caches, data, event: event.datetime,
    "active_at": lambda caches, data, event: event.datetime,
    "first_release": lambda caches, data, event: (
        caches["Release"](
            caches["Project"](event.project_id).organization_id, event.get_tag("sentry:release")
        )
        if event.get_tag("sentry:release")
        else data.get("first_release", None)
    ),
    "times_seen": lambda caches, data, event: data["times_seen"] + 1,
}


def get_group_creation_attributes(
    caches: Mapping[str, Any],
    group: Group,
    events: Sequence[GroupEvent],
) -> dict[str, Any]:
    latest_event = events[0]
    return reduce(
        lambda data, event: merge_mappings(
            [data, {name: f(caches, data, event) for name, f in backfill_fields.items()}]
        ),
        events,
        {name: f(latest_event, group) for name, f in initial_fields.items()},
    )


def get_group_backfill_attributes(
    caches: Mapping[str, Any], group: Group, events: Sequence[GroupEvent]
) -> dict[str, Any]:
    return {
        k: v
        for k, v in reduce(
            lambda data, event: merge_mappings(
                [data, {name: f(caches, data, event) for name, f in backfill_fields.items()}]
            ),
            events,
            {
                name: getattr(group, name)
                for name in set(initial_fields.keys()) | set(backfill_fields.keys())
            },
        ).items()
        if k in backfill_fields
    }


def get_fingerprint(event: GroupEvent) -> str | None:
    # TODO: This *might* need to be protected from an IndexError?
    return event.get_primary_hash()


def migrate_events(
    source: Group,
    caches: Mapping[str, Callable[..., Any]],
    project: Project,
    args: UnmergeArgs,
    events: Sequence[GroupEvent],
    locked_primary_hashes: Sequence[str],
    opt_destination_id: int | None,
    opt_eventstream_state: Mapping[str, Any] | None,
) -> tuple[int, Mapping[str, Any]]:
    extra = {"source_id": args.source_id, "project_id": project.id}
    logger.info(
        "migrate_events.start",
        extra={
            **extra,
            "opt_destination_id": opt_destination_id,
            "migrate_args": args,
        },
    )
    if opt_destination_id is None:
        # XXX: There is a race condition here between the (wall clock) time
        # that the migration is started by the user and when we actually
        # get to this block where the new destination is created and we've
        # moved the ``GroupHash`` so that events start being associated
        # with it. During this gap, there could have been additional events
        # ingested, and if we want to handle this, we'd need to record the
        # highest event ID we've seen at the beginning of the migration,
        # then scan all events greater than that ID and migrate the ones
        # where necessary. (This still isn't even guaranteed to catch all
        # of the events due to processing latency, but it's a better shot.)
        # Create a new destination group.
        destination = Group.objects.create(
            project_id=project.id,
            short_id=project.next_short_id(),
            **get_group_creation_attributes(caches, source, events),
        )

        destination_id = destination.id
    else:
        # Update the existing destination group.
        destination_id = opt_destination_id
        destination = Group.objects.get(id=destination_id)
        destination.update(**get_group_backfill_attributes(caches, destination, events))

    logger.info("migrate_events.migrate", extra={**extra, "destination_id": destination_id})

    if isinstance(args, InitialUnmergeArgs) or opt_eventstream_state is None:
        eventstream_state = args.replacement.start_snuba_replacement(
            project, args.source_id, destination_id
        )

        args.replacement.run_postgres_replacement(project, destination_id, locked_primary_hashes)

        # Create activity records for the source and destination group.
        Activity.objects.create(
            project_id=project.id,
            group_id=destination_id,
            type=ActivityType.UNMERGE_DESTINATION.value,
            user_id=args.actor_id,
            data={"source_id": args.source_id, **args.replacement.get_activity_args()},
        )

        Activity.objects.create(
            project_id=project.id,
            group_id=args.source_id,
            type=ActivityType.UNMERGE_SOURCE.value,
            user_id=args.actor_id,
            data={"destination_id": destination_id, **args.replacement.get_activity_args()},
        )
    else:
        eventstream_state = opt_eventstream_state

    event_id_set = {event.event_id for event in events}

    for event in events:
        event.group = destination

    event_id_set = {event.event_id for event in events}

    UserReport.objects.filter(project_id=project.id, event_id__in=event_id_set).update(
        group_id=destination_id
    )
    EventAttachment.objects.filter(project_id=project.id, event_id__in=event_id_set).update(
        group_id=destination_id
    )

    return (destination.id, eventstream_state)


def truncate_denormalizations(project: Project, group: Group) -> None:
    GroupRelease.objects.filter(group_id=group.id).delete()

    # XXX: This can cause a race condition with the ``FirstSeenEventCondition``
    # where notifications can be erroneously sent if they occur in this group
    # before the reprocessing of the denormalized data completes, since a new
    # ``GroupEnvironment`` will be created.
    for instance in GroupEnvironment.objects.filter(group_id=group.id):
        instance.delete()

    environment_ids = list(
        Environment.objects.filter(projects=group.project).values_list("id", flat=True)
    )

    tsdb.backend.delete([TSDBModel.group], [group.id], environment_ids=environment_ids)

    tsdb.backend.delete_distinct_counts(
        [TSDBModel.users_affected_by_group], [group.id], environment_ids=environment_ids
    )

    tsdb.backend.delete_frequencies(
        [TSDBModel.frequent_releases_by_group, TSDBModel.frequent_environments_by_group],
        [str(group.id)],
    )

    similarity.delete(project, group)


def collect_group_environment_data(
    events: Sequence[GroupEvent],
) -> dict[tuple[int, str], str | None]:
    """\
    Find the first release for a each group and environment pair from a
    date-descending sorted list of events.
    """
    results: dict[tuple[int, str], str | None] = {}
    for event in events:
        results[(event.group_id, get_environment_name(event))] = event.get_tag("sentry:release")
    return results


def repair_group_environment_data(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> None:
    for (group_id, env_name), first_release in collect_group_environment_data(events).items():
        fields = {}
        if first_release:
            fields["first_release"] = caches["Release"](project.organization_id, first_release)

        GroupEnvironment.objects.update_or_create(
            environment_id=caches["Environment"](project.organization_id, env_name).id,
            group_id=group_id,
            defaults=fields,
        )


def get_environment_name(event: GroupEvent) -> str:
    return Environment.get_name_or_default(event.get_tag("environment"))


def collect_release_data(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> dict[tuple[int, str, Release], tuple[datetime, datetime]]:
    results: dict[tuple[int, str, Release], tuple[datetime, datetime]] = {}

    for event in events:
        release = event.get_tag("sentry:release")

        if not release:
            continue

        key = (
            event.group_id,
            get_environment_name(event),
            caches["Release"](project.organization_id, release).id,
        )

        if key in results:
            _, last_seen = results[key]
            results[key] = (event.datetime, last_seen)
        else:
            results[key] = (event.datetime, event.datetime)

    return results


def repair_group_release_data(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> None:
    attributes = collect_release_data(caches, project, events).items()
    for (group_id, environment, release_id), (first_seen, last_seen) in attributes:
        instance, created = GroupRelease.objects.get_or_create(
            project_id=project.id,
            group_id=group_id,
            environment=environment,
            release_id=release_id,
            defaults={"first_seen": first_seen, "last_seen": last_seen},
        )

        if not created:
            instance.update(first_seen=first_seen)


def get_event_user_from_interface(value: dict[str, Any], project: Project) -> EventUser:
    analytics.record(
        EventUserEndpointRequest(
            project_id=project.id,
            endpoint="sentry.tasks.unmerge.get_event_user_from_interface",
        )
    )
    return EventUser(
        user_ident=value.get("id"),
        email=value.get("email"),
        username=value.get("valuename"),
        ip_address=value.get("ip_address"),
        project_id=project.id,
        name=None,
    )


def collect_tsdb_data(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> tuple[
    dict[datetime, dict[TSDBModel, dict[tuple[int, int], int]]],
    dict[datetime, dict[TSDBModel, dict[tuple[int, int], set[str]]]],
    dict[datetime, dict[TSDBModel, dict[str, dict[str, int | float]]]],
]:
    counters: dict[datetime, dict[TSDBModel, dict[tuple[int, int], int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )

    sets: dict[datetime, dict[TSDBModel, dict[tuple[int, int], set[str]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(set))
    )

    frequencies: dict[datetime, dict[TSDBModel, dict[str, dict[str, int | float]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    )

    for event in events:
        environment = caches["Environment"](project.organization_id, get_environment_name(event))

        counters[event.datetime][TSDBModel.group][(event.group_id, environment.id)] += 1

        user = event.data.get("user")
        if user:
            tag_value = get_event_user_from_interface(user, project).tag_value
            if tag_value is not None:
                sets[event.datetime][TSDBModel.users_affected_by_group][
                    (event.group_id, environment.id)
                ].add(tag_value)

        frequencies[event.datetime][TSDBModel.frequent_environments_by_group][str(event.group_id)][
            str(environment.id)
        ] += 1

        release = event.get_tag("sentry:release")
        if release:
            # TODO: I'm also not sure if "environment" here is correct, see
            # similar comment above during creation.
            grouprelease = caches["GroupRelease"](
                event.group_id,
                get_environment_name(event),
                caches["Release"](project.organization_id, release).id,
            )

            frequencies[event.datetime][TSDBModel.frequent_releases_by_group][str(event.group_id)][
                str(grouprelease.id)
            ] += 1

    return counters, sets, frequencies


def repair_tsdb_data(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> None:
    counters, sets, frequencies = collect_tsdb_data(caches, project, events)

    for timestamp, data in counters.items():
        for model, keys in data.items():
            for (key, environment_id), value in keys.items():
                tsdb.backend.incr(model, key, timestamp, value, environment_id=environment_id)

    for timestamp, sets_data in sets.items():
        for model, sets_keys in sets_data.items():
            for (key, environment_id), sets_values in sets_keys.items():
                # TODO: This should use `record_multi` rather than `record`.
                tsdb.backend.record(
                    model, key, list(sets_values), timestamp, environment_id=environment_id
                )

    for timestamp, frequencies_data in frequencies.items():
        # Convert the frequency data to the format expected by record_frequency_multi
        frequency_requests: list[tuple[TSDBModel, Mapping[str, Mapping[str, int | float]]]] = [
            (freq_model, freq_model_data)
            for freq_model, freq_model_data in frequencies_data.items()
        ]
        if frequency_requests:
            tsdb.backend.record_frequency_multi(
                frequency_requests,
                timestamp,
            )


def repair_denormalizations(
    caches: Mapping[str, Any], project: Project, events: Sequence[GroupEvent]
) -> None:
    repair_group_environment_data(caches, project, events)
    repair_group_release_data(caches, project, events)
    repair_tsdb_data(caches, project, events)

    # Skip MinHash similarity indexing for projects that have been backfilled to Seer.
    # Those projects use Seer's embeddings-based similarity instead.
    if not project.get_option("sentry:similarity_backfill_completed"):
        for event in events:
            similarity.record(project, [event])


def lock_hashes(project_id: int, source_id: int, fingerprints: Sequence[str]) -> list[str]:
    with transaction.atomic(router.db_for_write(GroupHash)):
        eligible_hashes = list(
            GroupHash.objects.filter(
                project_id=project_id, group_id=source_id, hash__in=fingerprints
            )
            .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            .select_for_update()
        )

        GroupHash.objects.filter(id__in=[h.id for h in eligible_hashes]).update(
            state=GroupHash.State.LOCKED_IN_MIGRATION
        )

    return [h.hash for h in eligible_hashes]


def unlock_hashes(project_id: int, locked_primary_hashes: Sequence[str]) -> None:
    GroupHash.objects.filter(
        project_id=project_id,
        hash__in=locked_primary_hashes,
        state=GroupHash.State.LOCKED_IN_MIGRATION,
    ).update(state=GroupHash.State.UNLOCKED)


@instrumented_task(
    name="sentry.tasks.unmerge",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def unmerge(*posargs: Any, **kwargs: Any) -> None:
    args = UnmergeArgsBase.parse_arguments(*posargs, **kwargs)
    extra = {"source_id": args.source_id, "project_id": args.project_id}
    logger.info("unmerge.start.task", extra=extra)

    source = Group.objects.get(project_id=args.project_id, id=args.source_id)

    caches: Mapping[str, Any] = get_caches()

    project = caches["Project"](args.project_id)

    # On the first iteration of this loop, we clear out all of the
    # denormalizations from the source group so that we can have a clean slate
    # for the new, repaired data.
    if isinstance(args, InitialUnmergeArgs):
        locked_primary_hashes = lock_hashes(
            args.project_id, args.source_id, list(args.replacement.primary_hashes_to_lock)
        )
        truncate_denormalizations(project, source)
        last_event = None
    else:
        last_event = args.last_event
        locked_primary_hashes = list(args.locked_primary_hashes)

    last_event, raw_events = task_run_batch_query(
        filter=eventstore.Filter(project_ids=[args.project_id], group_ids=[source.id]),
        batch_size=args.batch_size,
        state=last_event,
        referrer="unmerge",
        tenant_ids={"organization_id": source.project.organization_id},
    )
    # Convert Event objects to GroupEvent objects
    events: list[GroupEvent] = [event.for_group(source) for event in raw_events]
    # Log info related to this unmerge
    logger.info("unmerge.check", extra={**extra, "num_events": len(events)})

    # If there are no more events to process, we're done with the migration.
    if not events:
        unlock_hashes(args.project_id, locked_primary_hashes)
        for unmerge_key, (_, eventstream_state) in args.destinations.items():
            logger.warning(
                "Unmerge complete (eventstream state: %s)", eventstream_state, extra=extra
            )
            if eventstream_state:
                args.replacement.stop_snuba_replacement(eventstream_state)
        return

    source_events = []
    destination_events: dict[str, list[GroupEvent]] = {}

    for event in events:
        key = args.replacement.get_unmerge_key(event, locked_primary_hashes)
        if key is not None:
            destination_events.setdefault(key, []).append(event)
        else:
            source_events.append(event)

    source_fields_reset = isinstance(args, SuccessiveUnmergeArgs) and args.source_fields_reset

    if source_events:
        if not source_fields_reset:
            source.update(**get_group_creation_attributes(caches, source, source_events))
            source_fields_reset = True
        else:
            source.update(**get_group_backfill_attributes(caches, source, source_events))

    destinations = dict(args.destinations)
    # Log info related to this unmerge
    logger.info(
        "unmerge.destinations",
        extra={
            **extra,
            "source_events": len(source_events),
            "destination_events": len(destination_events),
            "source_fields_reset": source_fields_reset,
        },
    )

    # XXX: This is only actually able to create a destination group and migrate
    # the group hashes if there are events that can be migrated. How do we
    # handle this if there aren't any events? We can't create a group (there
    # isn't any data to derive the aggregates from), so we'd have to mark the
    # hash as in limbo somehow...?)

    for unmerge_key, _destination_events in destination_events.items():
        destination_id, eventstream_state = destinations.get(unmerge_key) or (None, None)
        (destination_id, eventstream_state) = migrate_events(
            source,
            caches,
            project,
            args,
            _destination_events,
            locked_primary_hashes,
            destination_id,
            eventstream_state,
        )
        destinations[unmerge_key] = destination_id, eventstream_state

    repair_denormalizations(caches, project, events)

    new_args = SuccessiveUnmergeArgs(
        project_id=args.project_id,
        source_id=args.source_id,
        replacement=args.replacement,
        actor_id=args.actor_id,
        batch_size=args.batch_size,
        last_event=last_event,
        destinations=destinations,
        locked_primary_hashes=locked_primary_hashes,
        source_fields_reset=source_fields_reset,
    )

    unmerge.delay(**new_args.dump_arguments())
