from __future__ import absolute_import

import logging
from collections import defaultdict

from django.db.models import F

from sentry.app import tsdb
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS_MAP
from sentry.event_manager import ScoreClause, generate_culprit, get_hashes_for_event, md5_from_hash
from sentry.models import Environment, Event, EventMapping, EventTag, EventUser, Group, GroupHash, GroupRelease, GroupTagKey, GroupTagValue, Project, Release, UserReport


def merge_mappings(values):
    result = {}
    for value in values:
        result.update(value)
    return result


initial_fields = {
    'culprit': lambda event: generate_culprit(
        event.data,
        event.platform,
    ),
    'data': lambda event: {
        'last_received': event.data.get('received') or float(event.datetime.strftime('%s')),
        'type': event.data['type'],
        'metadata': event.data['metadata'],
    },
    'last_seen': lambda event: event.datetime,
    'level': lambda event: LOG_LEVELS_MAP.get(
        event.get_tag('level'),
        logging.ERROR,
    ),
    'message': lambda event: event.message,
    'times_seen': lambda event: 0,
}


backfill_fields = {
    'platform': lambda data, event: event.platform,
    'logger': lambda data, event: event.get_tag('logger') or DEFAULT_LOGGER_NAME,
    'first_seen': lambda data, event: event.datetime,
    'active_at': lambda data, event: event.datetime,
    'first_release': lambda data, event: Release.objects.get(
        organization_id=event.project.organization_id,
        version=event.get_tag('sentry:release')
    ) if event.get_tag('sentry:release') else data.get('first_release', None),  # XXX: This is wildly inefficient, also double check logic.
    'times_seen': lambda data, event: data['times_seen'] + 1,
    'score': lambda data, event: ScoreClause.calculate(
        data['times_seen'] + 1,
        data['last_seen'],
    ),
}


def get_group_creation_attributes(events):
    latest_event = events[0]
    return reduce(
        lambda data, event: merge_mappings([
            data,
            {name: f(data, event) for name, f in backfill_fields.items()},
        ]),
        events,
        {name: f(latest_event) for name, f in initial_fields.items()},
    )


def get_group_backfill_attributes(group, events):
    return {
        k: v for k, v in
        reduce(
            lambda data, event: merge_mappings([
                data,
                {name: f(data, event) for name, f in backfill_fields.items()},
            ]),
            events,
            {name: getattr(group, name) for name in set(initial_fields.keys()) | set(backfill_fields.keys())},
        ).items()
        if k in backfill_fields
    }


def get_fingerprint(event):
    # TODO: This *might* need to be protected from an IndexError?
    primary_hash = get_hashes_for_event(event)[0]
    return md5_from_hash(primary_hash)


def migrate_events(project, destination_id, fingerprints, events):
    # XXX: This is only actually able to create a destination group and migrate
    # the group hashes if there are events that can be migrated. How do we
    # handle this if there aren't any events? We can't create a group (there
    # isn't any data to derive the aggregates from), so we'd have to mark the
    # hash as in limbo somehow...?)
    if not events:
        return destination_id

    if destination_id is None:
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
            **get_group_creation_attributes(events)
        )

        destination_id = destination.id

        # Move the group hashes to the destination.
        # TODO: What happens if this ``GroupHash`` has already been
        # migrated somewhere else? Right now, this just assumes we have
        # exclusive access to it (which is not a safe assumption.)
        GroupHash.objects.filter(
            project_id=project.id,
            hash__in=fingerprints,
        ).update(group=destination_id)

        # TODO: Create activity records for the source and destination group.
    else:
        # Update the existing destination group.
        destination = Group.objects.get(id=destination_id)
        destination.update(**get_group_backfill_attributes(destination, events))

    event_id_set = set(event.id for event in events)

    Event.objects.filter(
        project_id=project.id,
        id__in=event_id_set,
    ).update(group_id=destination_id)

    for event in events:
        event.group = destination

    EventTag.objects.filter(
        project_id=project.id,
        event_id__in=event_id_set,
    ).update(group_id=destination_id)

    event_event_id_set = set(event.event_id for event in events)

    EventMapping.objects.filter(
        project_id=project.id,
        event_id__in=event_event_id_set,
    ).update(group_id=destination_id)

    UserReport.objects.filter(
        project_id=project.id,
        event_id__in=event_event_id_set,
    ).update(group=destination_id)

    return destination.id


def truncate_denormalizations(group_id):
    GroupTagKey.objects.filter(
        group_id=group_id,
    ).delete()

    GroupTagValue.objects.filter(
        group_id=group_id,
    ).delete()

    GroupRelease.objects.filter(
        group_id=group_id,
    ).delete()

    tsdb.delete([
        tsdb.models.group,
    ], [group_id])

    tsdb.delete_distinct_counts([
        tsdb.models.users_affected_by_group,
    ], [group_id])

    tsdb.delete_frequencies([
        tsdb.models.frequent_releases_by_group,
        tsdb.models.frequent_environments_by_group,
    ], [group_id])


def collect_tag_data(events):
    results = {}

    for event in events:
        tags = results.setdefault(event.group_id, {})

        for key, value in event.get_tags():
            values = tags.setdefault(key, {})

            if value in values:
                times_seen, first_seen, last_seen = values[value]
                values[value] = (times_seen + 1, event.datetime, last_seen)
            else:
                values[value] = (1, event.datetime, event.datetime)

    return results


def repair_tag_data(project, events):
    # Repair `GroupTag{Key,Value}` data.
    for group_id, keys in collect_tag_data(events).items():
        for key, values in keys.items():
            GroupTagKey.objects.get_or_create(
                project_id=project.id,
                group_id=group_id,
                key=key,
            )

            # XXX: `{first,last}_seen` columns don't totally replicate the
            # ingestion logic (but actually represent a more accurate value.)
            # See GH-5289 for more details.
            for value, (times_seen, first_seen, last_seen) in values.items():
                instance, created = GroupTagValue.objects.get_or_create(
                    project_id=project.id,
                    group_id=group_id,
                    key=key,
                    value=value,
                    defaults={
                        'first_seen': first_seen,
                        'last_seen': last_seen,
                        'times_seen': times_seen,
                    },
                )

                if not created:
                    instance.update(
                        first_seen=first_seen,
                        times_seen=F('times_seen') + times_seen,
                    )


def collect_release_data(project, events):
    results = {}

    for event in events:
        release = event.get_tag('sentry:release')

        # TODO: Double check this!
        if not release:
            continue

        # XXX: It's not really clear what the canonical source is for
        # environment between the tag and the data attribute, but I'm going
        # with data attribute for now. Right now it seems like they are
        # intended to both be present and the same value, but I'm not really
        # sure that has always been the case for existing values.
        # NOTE: ``GroupRelease.environment`` is not nullable, but an empty
        # string is OK.
        environment = event.data.get('environment', '')

        key = (
            event.group_id,
            environment,
            Release.objects.get(  # XXX: This lookup should be cached.
                organization_id=project.organization_id,
                version=release,
            ).id,
        )

        if key in results:
            first_seen, last_seen = results[key]
            results[key] = (event.datetime, last_seen)
        else:
            results[key] = (event.datetime, event.datetime)

    return results


def repair_group_release_data(project, events):
    attributes = collect_release_data(project, events).items()
    for (group_id, environment, release_id), (first_seen, last_seen) in attributes:
        instance, created = GroupRelease.objects.get_or_create(
            project_id=project.id,
            group_id=group_id,
            environment=environment,
            release_id=release_id,
            defaults={
                'first_seen': first_seen,
                'last_seen': last_seen,
            },
        )

        if not created:
            instance.update(first_seen=first_seen)


def collect_tsdb_data(project, events):
    counters = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(int),
        ),
    )

    sets = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(int),
        ),
    )

    frequencies = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(int),
            ),
        ),
    )

    for event in events:
        counters[event.datetime][tsdb.models.group][event.group_id] += 1

        user = event.data.get('sentry.interfaces.User')
        if user:
            sets[event.datetime][tsdb.models.users_affected_by_group][event.group_id].add(
                EventUser(
                    project=project,
                    ident=user.get('id'),
                    email=user.get('email'),
                    username=user.get('username'),
                    ip_address=user.get('ip_address'),
                ).tag_value
            )

        environment = Environment.objects.get(
            projects=project,
            name=event.data.get('environment', ''),
        )

        frequencies[event.datetime][tsdb.models.frequent_environments_by_group][event.group_id][environment.id] += 1

        # TODO: Double check this!
        release = event.get_tag('sentry:release')
        if release:
            # TODO: I'm also not sure if this is correct, see similar comment
            # above during creation.
            environment = event.data.get('environment', '')

            # XXX: This is also inefficient, especially since we have created
            # or updated the record already in this process.
            grouprelease = GroupRelease.objects.get(
                group_id=event.group_id,
                environment=environment,
                release_id=Release.objects.get(
                    organization_id=project.organization_id,
                    version=release,
                ).id,
            )

            frequencies[event.datetime][tsdb.models.frequent_releases_by_group][event.group_id][grouprelease.id] += 1

    return counters, sets, frequencies


def repair_tsdb_data(project, events):
    counters, sets, frequencies = collect_tsdb_data(project, events)

    for timestamp, data in counters.items():
        for model, keys in data.items():
            for key, value in keys.items():
                tsdb.incr(model, key, timestamp, value)

    for timestamp, data in sets.items():
        for model, keys in data.items():
            for key, values in keys.items():
                # TODO: This should use `record_multi` rather than `record`.
                tsdb.record(model, key, values, timestamp)

    for timestamp, data in frequencies.items():
        tsdb.record_frequency_multi(data.items(), timestamp)


def repair_denormalizations(project, events):
    repair_tag_data(project, events)
    repair_group_release_data(project, events)
    repair_tsdb_data(project, events)


def update_tag_value_counts(id_list):
    instances = GroupTagKey.objects.filter(group_id__in=id_list)
    for instance in instances:
        instance.update(
            values_seen=GroupTagValue.objects.filter(
                project_id=instance.project_id,
                group_id=instance.group_id,
                key=instance.key,
            ).count(),
        )


def unmerge(project_id, source_id, destination_id, fingerprints, cursor=None, batch_size=500):
    # XXX: If a ``GroupHash`` is unmerged *again* while this operation is
    # already in progress, some events from the fingerprint associated with the
    # hash may not be migrated to the new destination! We could solve this with
    # an exclusive lock on the ``GroupHash`` record (I think) as long as
    # nothing in the ``EventManager`` is going to try and preempt that. (I'm
    # not 100% sure that's the case.)

    # XXX: The queryset chunking logic below is awfully similar to
    # ``RangeQuerySetWrapper``. Ideally that could be refactored to be able to
    # be run without iteration by passing around a state object and we could
    # just use that here instead.

    # On the first iteration of this loop, we clear out all of the
    # denormalizations from the source group so that we can have a clean slate
    # for the new, repaired data.
    if cursor is None:
        truncate_denormalizations(source_id)

    project = Project.objects.get(id=project_id)

    # TODO: It might make sense to fetch the source group to assert that it is
    # contained within the project, even though we don't actually directy use
    # it anywhere.

    # We fetch the events in descending order by their primary key to get the
    # best approximation of the most recently received events.
    queryset = Event.objects.filter(
        project_id=project_id,
        group_id=source_id,
    ).order_by('-id')

    if cursor is not None:
        queryset = queryset.filter(id__lt=cursor)

    events = list(queryset[:batch_size])

    # If there are no more events to process, we're done with the migration.
    if not events:
        update_tag_value_counts([source_id, destination_id])
        return destination_id

    Event.objects.bind_nodes(events, 'data')

    destination_id = migrate_events(
        project,
        destination_id,
        fingerprints,
        filter(
            lambda event: get_fingerprint(event) in fingerprints,
            events,
        )
    )

    repair_denormalizations(
        project,
        events,
    )

    return unmerge(
        project_id,
        source_id,
        destination_id,
        fingerprints,
        cursor=events[-1].id,
        batch_size=batch_size,
    )
