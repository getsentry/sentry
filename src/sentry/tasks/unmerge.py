import logging
from collections import OrderedDict, defaultdict
from functools import reduce
from typing import Any, Mapping, Optional, Tuple

from django.db import transaction

from sentry import eventstore, similarity
from sentry.app import tsdb
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS_MAP
from sentry.event_manager import generate_culprit
from sentry.models import (
    Activity,
    Environment,
    EventAttachment,
    EventUser,
    Group,
    GroupEnvironment,
    GroupHash,
    GroupRelease,
    Project,
    Release,
    UserReport,
)
from sentry.tasks.base import instrumented_task
from sentry.unmerge import InitialUnmergeArgs, SuccessiveUnmergeArgs, UnmergeArgs, UnmergeArgsBase
from sentry.utils.query import celery_run_batch_query
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def cache(function):
    results = {}

    def fetch(*key):
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
            raise result

    return fetch


def get_caches():
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


def merge_mappings(values):
    result = {}
    for value in values:
        result.update(value)
    return result


def _generate_culprit(event):
    # XXX(mitsuhiko): workaround: some old events do not have this data yet.
    # This should be save delete by end of 2019 even considering slow on-prem
    # releases.  Platform was added back to data in december 2018.
    data = event.data
    if data.get("platform") is None:
        data = dict(data.items())
        data["platform"] = event.platform
    return generate_culprit(data)


def group_metadata_from_event_metadata(event):
    # XXX(markus): current_tree_label will have to be fixed once one can
    # set the level, right now we can get away with setting the outermost
    # level because that's the default and you can't change it.
    #
    # There's more stuff that has to change in unmerge anyway, wrt which hashes
    # are persisted if split/unsplit ever lands.

    rv = dict(event.data["metadata"])
    current_tree_label = get_path(event.data, "hierarchical_tree_labels", 0) or None
    if current_tree_label is not None:
        rv["current_tree_label"] = current_tree_label

    return rv


initial_fields = {
    "culprit": lambda event: _generate_culprit(event),
    "data": lambda event: {
        "last_received": event.data.get("received") or float(event.datetime.strftime("%s")),
        "type": event.data["type"],
        "metadata": group_metadata_from_event_metadata(event),
    },
    "last_seen": lambda event: event.datetime,
    "level": lambda event: LOG_LEVELS_MAP.get(event.get_tag("level"), logging.ERROR),
    "message": lambda event: event.search_message,
    "times_seen": lambda event: 0,
}


backfill_fields = {
    "platform": lambda caches, data, event: event.platform,
    "logger": lambda caches, data, event: event.get_tag("logger") or DEFAULT_LOGGER_NAME,
    "first_seen": lambda caches, data, event: event.datetime,
    "active_at": lambda caches, data, event: event.datetime,
    "first_release": lambda caches, data, event: caches["Release"](
        caches["Project"](event.project_id).organization_id, event.get_tag("sentry:release")
    )
    if event.get_tag("sentry:release")
    else data.get("first_release", None),
    "times_seen": lambda caches, data, event: data["times_seen"] + 1,
    "score": lambda caches, data, event: Group.calculate_score(
        data["times_seen"] + 1, data["last_seen"]
    ),
}


def get_group_creation_attributes(caches, events):
    latest_event = events[0]
    return reduce(
        lambda data, event: merge_mappings(
            [data, {name: f(caches, data, event) for name, f in backfill_fields.items()}]
        ),
        events,
        {name: f(latest_event) for name, f in initial_fields.items()},
    )


def get_group_backfill_attributes(caches, group, events):
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


def get_fingerprint(event):
    # TODO: This *might* need to be protected from an IndexError?
    return event.get_primary_hash()


def migrate_events(
    caches,
    project,
    args: UnmergeArgs,
    events,
    locked_primary_hashes,
    opt_destination_id: Optional[int],
    opt_eventstream_state: Optional[Mapping[str, Any]],
) -> Tuple[int, Mapping[str, Any]]:
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
            **get_group_creation_attributes(caches, events),
        )

        destination_id = destination.id
    else:
        # Update the existing destination group.
        destination_id = opt_destination_id
        destination = Group.objects.get(id=destination_id)
        destination.update(**get_group_backfill_attributes(caches, destination, events))

    if isinstance(args, InitialUnmergeArgs) or opt_eventstream_state is None:
        eventstream_state = args.replacement.start_snuba_replacement(
            project, args.source_id, destination_id
        )

        args.replacement.run_postgres_replacement(project, destination_id, locked_primary_hashes)

        # Create activity records for the source and destination group.
        Activity.objects.create(
            project_id=project.id,
            group_id=destination_id,
            type=Activity.UNMERGE_DESTINATION,
            user_id=args.actor_id,
            data={"source_id": args.source_id, **args.replacement.get_activity_args()},
        )

        Activity.objects.create(
            project_id=project.id,
            group_id=args.source_id,
            type=Activity.UNMERGE_SOURCE,
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


def truncate_denormalizations(project, group):
    GroupRelease.objects.filter(group_id=group.id).delete()

    # XXX: This can cause a race condition with the ``FirstSeenEventCondition``
    # where notifications can be erroneously sent if they occur in this group
    # before the reprocessing of the denormalizated data completes, since a new
    # ``GroupEnvironment`` will be created.
    for instance in GroupEnvironment.objects.filter(group_id=group.id):
        instance.delete()

    environment_ids = list(
        Environment.objects.filter(projects=group.project).values_list("id", flat=True)
    )

    tsdb.delete([tsdb.models.group], [group.id], environment_ids=environment_ids)

    tsdb.delete_distinct_counts(
        [tsdb.models.users_affected_by_group], [group.id], environment_ids=environment_ids
    )

    tsdb.delete_frequencies(
        [tsdb.models.frequent_releases_by_group, tsdb.models.frequent_environments_by_group],
        [group.id],
    )

    similarity.delete(project, group)


def collect_group_environment_data(events):
    """\
    Find the first release for a each group and environment pair from a
    date-descending sorted list of events.
    """
    results = OrderedDict()
    for event in events:
        results[(event.group_id, get_environment_name(event))] = event.get_tag("sentry:release")
    return results


def repair_group_environment_data(caches, project, events):
    for (group_id, env_name), first_release in collect_group_environment_data(events).items():
        fields = {}
        if first_release:
            fields["first_release"] = caches["Release"](project.organization_id, first_release)

        GroupEnvironment.objects.create_or_update(
            environment_id=caches["Environment"](project.organization_id, env_name).id,
            group_id=group_id,
            defaults=fields,
            values=fields,
        )


def collect_tag_data(events):
    results = OrderedDict()

    for event in events:
        environment = get_environment_name(event)
        tags = results.setdefault((event.group_id, environment), {})

        for key, value in event.tags:
            values = tags.setdefault(key, {})

            if value in values:
                times_seen, first_seen, last_seen = values[value]
                values[value] = (times_seen + 1, event.datetime, last_seen)
            else:
                values[value] = (1, event.datetime, event.datetime)

    return results


def get_environment_name(event):
    return Environment.get_name_or_default(event.get_tag("environment"))


def collect_release_data(caches, project, events):
    results = OrderedDict()

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
            first_seen, last_seen = results[key]
            results[key] = (event.datetime, last_seen)
        else:
            results[key] = (event.datetime, event.datetime)

    return results


def repair_group_release_data(caches, project, events):
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


def get_event_user_from_interface(value):
    return EventUser(
        ident=value.get("id"),
        email=value.get("email"),
        username=value.get("valuename"),
        ip_address=value.get("ip_address"),
    )


def collect_tsdb_data(caches, project, events):
    counters = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

    sets = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))

    frequencies = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))

    for event in events:
        environment = caches["Environment"](project.organization_id, get_environment_name(event))

        counters[event.datetime][tsdb.models.group][(event.group_id, environment.id)] += 1

        user = event.data.get("user")
        if user:
            sets[event.datetime][tsdb.models.users_affected_by_group][
                (event.group_id, environment.id)
            ].add(get_event_user_from_interface(user).tag_value)

        frequencies[event.datetime][tsdb.models.frequent_environments_by_group][event.group_id][
            environment.id
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

            frequencies[event.datetime][tsdb.models.frequent_releases_by_group][event.group_id][
                grouprelease.id
            ] += 1

    return counters, sets, frequencies


def repair_tsdb_data(caches, project, events):
    counters, sets, frequencies = collect_tsdb_data(caches, project, events)

    for timestamp, data in counters.items():
        for model, keys in data.items():
            for (key, environment_id), value in keys.items():
                tsdb.incr(model, key, timestamp, value, environment_id=environment_id)

    for timestamp, data in sets.items():
        for model, keys in data.items():
            for (key, environment_id), values in keys.items():
                # TODO: This should use `record_multi` rather than `record`.
                tsdb.record(model, key, values, timestamp, environment_id=environment_id)

    for timestamp, data in frequencies.items():
        tsdb.record_frequency_multi(data.items(), timestamp)


def repair_denormalizations(caches, project, events):
    repair_group_environment_data(caches, project, events)
    repair_group_release_data(caches, project, events)
    repair_tsdb_data(caches, project, events)

    for event in events:
        similarity.record(project, [event])


def lock_hashes(project_id, source_id, fingerprints):
    with transaction.atomic():
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


def unlock_hashes(project_id, locked_primary_hashes):
    GroupHash.objects.filter(
        project_id=project_id,
        hash__in=locked_primary_hashes,
        state=GroupHash.State.LOCKED_IN_MIGRATION,
    ).update(state=GroupHash.State.UNLOCKED)


@instrumented_task(name="sentry.tasks.unmerge", queue="unmerge")
def unmerge(*posargs, **kwargs):
    args = UnmergeArgsBase.parse_arguments(*posargs, **kwargs)

    source = Group.objects.get(project_id=args.project_id, id=args.source_id)

    caches = get_caches()

    project = caches["Project"](args.project_id)

    # On the first iteration of this loop, we clear out all of the
    # denormalizations from the source group so that we can have a clean slate
    # for the new, repaired data.
    if isinstance(args, InitialUnmergeArgs):
        locked_primary_hashes = lock_hashes(
            args.project_id, args.source_id, args.replacement.primary_hashes_to_lock
        )
        truncate_denormalizations(project, source)
        last_event = None
    else:
        last_event = args.last_event
        locked_primary_hashes = args.locked_primary_hashes

    last_event, events = celery_run_batch_query(
        filter=eventstore.Filter(project_ids=[args.project_id], group_ids=[source.id]),
        batch_size=args.batch_size,
        state=last_event,
        referrer="unmerge",
    )

    # If there are no more events to process, we're done with the migration.
    if not events:
        unlock_hashes(args.project_id, locked_primary_hashes)
        for unmerge_key, (group_id, eventstream_state) in args.destinations.items():
            logger.warning("Unmerge complete (eventstream state: %s)", eventstream_state)
            if eventstream_state:
                args.replacement.stop_snuba_replacement(eventstream_state)
        return

    source_events = []
    destination_events = {}

    for event in events:
        unmerge_key = args.replacement.get_unmerge_key(event, locked_primary_hashes)
        if unmerge_key is not None:
            destination_events.setdefault(unmerge_key, []).append(event)
        else:
            source_events.append(event)

    source_fields_reset = isinstance(args, SuccessiveUnmergeArgs) and args.source_fields_reset

    if source_events:
        if not source_fields_reset:
            source.update(**get_group_creation_attributes(caches, source_events))
            source_fields_reset = True
        else:
            source.update(**get_group_backfill_attributes(caches, source, source_events))

    destinations = dict(args.destinations)

    # XXX: This is only actually able to create a destination group and migrate
    # the group hashes if there are events that can be migrated. How do we
    # handle this if there aren't any events? We can't create a group (there
    # isn't any data to derive the aggregates from), so we'd have to mark the
    # hash as in limbo somehow...?)

    for unmerge_key, _destination_events in destination_events.items():
        destination_id, eventstream_state = destinations.get(unmerge_key) or (None, None)
        (destination_id, eventstream_state) = migrate_events(
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
