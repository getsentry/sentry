from __future__ import absolute_import

import logging
from collections import defaultdict

from django.db import transaction

from sentry import tagstore
from sentry.app import tsdb
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS_MAP
from sentry.event_manager import (
    ScoreClause, generate_culprit, get_fingerprint_for_event, get_hashes_from_fingerprint, md5_from_hash
)
from sentry.models import (
    Activity, Environment, Event, EventMapping, EventUser, Group, GroupHash, GroupRelease,
    Project, Release, UserReport
)
from sentry.similarity import features
from sentry.tasks.base import instrumented_task
from six.moves import reduce


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
        'Environment': cache(
            lambda organization_id, name: Environment.objects.get(
                organization_id=organization_id,
                name=name,
            ),
        ),
        'GroupRelease': cache(
            lambda group_id, environment, release_id: GroupRelease.objects.get(
                group_id=group_id,
                environment=environment,
                release_id=release_id,
            ),
        ),
        'Project': cache(
            lambda id: Project.objects.get(id=id),
        ),
        'Release': cache(
            lambda organization_id, version: Release.objects.get(
                organization_id=organization_id,
                version=version,
            ),
        ),
    }


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
    'platform': lambda caches, data, event: event.platform,
    'logger': lambda caches, data, event: event.get_tag('logger') or DEFAULT_LOGGER_NAME,
    'first_seen': lambda caches, data, event: event.datetime,
    'active_at': lambda caches, data, event: event.datetime,
    'first_release': lambda caches, data, event: caches['Release'](
        caches['Project'](event.project_id).organization_id,
        event.get_tag('sentry:release'),
    ) if event.get_tag('sentry:release') else data.get('first_release', None),
    'times_seen': lambda caches, data, event: data['times_seen'] + 1,
    'score': lambda caches, data, event: ScoreClause.calculate(
        data['times_seen'] + 1,
        data['last_seen'],
    ),
}


def get_group_creation_attributes(caches, events):
    latest_event = events[0]
    return reduce(
        lambda data, event: merge_mappings([
            data,
            {name: f(caches, data, event) for name, f in backfill_fields.items()},
        ]),
        events,
        {name: f(latest_event) for name, f in initial_fields.items()},
    )


def get_group_backfill_attributes(caches, group, events):
    return {
        k: v for k, v in
        reduce(
            lambda data, event: merge_mappings([
                data,
                {name: f(caches, data, event) for name, f in backfill_fields.items()},
            ]),
            events,
            {name: getattr(group, name)
             for name in set(initial_fields.keys()) | set(backfill_fields.keys())},
        ).items()
        if k in backfill_fields
    }


def get_fingerprint(event):
    # TODO: This *might* need to be protected from an IndexError?
    primary_hash = get_hashes_from_fingerprint(
        event,
        get_fingerprint_for_event(event),
    )[0]
    return md5_from_hash(primary_hash)


def migrate_events(caches, project, source_id, destination_id, fingerprints, events, actor_id):
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
            **get_group_creation_attributes(caches, events)
        )

        destination_id = destination.id

        # Move the group hashes to the destination.
        GroupHash.objects.filter(
            project_id=project.id,
            hash__in=fingerprints,
        ).update(group=destination_id)

        # Create activity records for the source and destination group.
        Activity.objects.create(
            project_id=project.id,
            group_id=destination_id,
            type=Activity.UNMERGE_DESTINATION,
            user_id=actor_id,
            data={
                'fingerprints': fingerprints,
                'source_id': source_id,
            },
        )

        Activity.objects.create(
            project_id=project.id,
            group_id=source_id,
            type=Activity.UNMERGE_SOURCE,
            user_id=actor_id,
            data={
                'fingerprints': fingerprints,
                'destination_id': destination_id,
            },
        )
    else:
        # Update the existing destination group.
        destination = Group.objects.get(id=destination_id)
        destination.update(**get_group_backfill_attributes(caches, destination, events))

    event_id_set = set(event.id for event in events)

    Event.objects.filter(
        project_id=project.id,
        id__in=event_id_set,
    ).update(group_id=destination_id)

    for event in events:
        event.group = destination

    tagstore.get_event_tag_qs(
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


def truncate_denormalizations(group):
    tagstore.delete_all_group_tag_keys(group.id)
    tagstore.delete_all_group_tag_values(group.id)

    GroupRelease.objects.filter(
        group_id=group.id,
    ).delete()

    environment_ids = list(
        Environment.objects.filter(
            projects=group.project
        ).values_list('id', flat=True)
    )

    tsdb.delete([
        tsdb.models.group,
    ], [group.id], environment_ids=environment_ids)

    tsdb.delete_distinct_counts([
        tsdb.models.users_affected_by_group,
    ], [group.id], environment_ids=environment_ids)

    tsdb.delete_frequencies(
        [
            tsdb.models.frequent_releases_by_group,
            tsdb.models.frequent_environments_by_group,
        ], [group.id]
    )

    features.delete(group)


def collect_tag_data(events):
    results = {}

    for event in events:
        environment = get_environment_name(event)
        tags = results.setdefault((event.group_id, environment), {})

        for key, value in event.get_tags():
            values = tags.setdefault(key, {})

            if value in values:
                times_seen, first_seen, last_seen = values[value]
                values[value] = (times_seen + 1, event.datetime, last_seen)
            else:
                values[value] = (1, event.datetime, event.datetime)

    return results


def repair_tag_data(caches, project, events):
    for (group_id, env_name), keys in collect_tag_data(events).items():
        environment = caches['Environment'](
            project.organization_id,
            env_name,
        )
        for key, values in keys.items():
            tagstore.get_or_create_group_tag_key(
                project_id=project.id,
                group_id=group_id,
                environment_id=environment.id,
                key=key,
            )

            # XXX: `{first,last}_seen` columns don't totally replicate the
            # ingestion logic (but actually represent a more accurate value.)
            # See GH-5289 for more details.
            for value, (times_seen, first_seen, last_seen) in values.items():
                instance, created = tagstore.get_or_create_group_tag_value(
                    project_id=project.id,
                    group_id=group_id,
                    environment_id=environment.id,
                    key=key,
                    value=value,
                    defaults={
                        'first_seen': first_seen,
                        'last_seen': last_seen,
                        'times_seen': times_seen,
                    },
                )

                if not created:
                    tagstore.incr_group_tag_value_times_seen(
                        project_id=project.id,
                        group_id=group_id,
                        environment_id=environment.id,
                        key=key,
                        value=value,
                        count=times_seen,
                        extra={'first_seen': first_seen}
                    )


def get_environment_name(event):
    return Environment.get_name_or_default(event.get_tag('environment'))


def collect_release_data(caches, project, events):
    results = {}

    for event in events:
        release = event.get_tag('sentry:release')

        if not release:
            continue

        key = (
            event.group_id, get_environment_name(event), caches['Release'](
                project.organization_id,
                release,
            ).id,
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
            defaults={
                'first_seen': first_seen,
                'last_seen': last_seen,
            },
        )

        if not created:
            instance.update(first_seen=first_seen)


def get_event_user_from_interface(value):
    return EventUser(
        ident=value.get('id'),
        email=value.get('email'),
        username=value.get('valuename'),
        ip_address=value.get('ip_address'),
    )


def collect_tsdb_data(caches, project, events):
    counters = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(int),
        ),
    )

    sets = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(set),
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
        environment = caches['Environment'](
            project.organization_id,
            get_environment_name(event),
        )

        counters[event.datetime][tsdb.models.group][(event.group_id, environment.id)] += 1

        user = event.data.get('sentry.interfaces.User')
        if user:
            sets[event.datetime][tsdb.models.users_affected_by_group][(event.group_id, environment.id)].add(
                get_event_user_from_interface(user).tag_value,
            )

        frequencies[event.datetime][tsdb.models.frequent_environments_by_group
                                    ][event.group_id][environment.id] += 1

        release = event.get_tag('sentry:release')
        if release:
            # TODO: I'm also not sure if "environment" here is correct, see
            # similar comment above during creation.
            grouprelease = caches['GroupRelease'](
                event.group_id,
                get_environment_name(event),
                caches['Release'](
                    project.organization_id,
                    release,
                ).id,
            )

            frequencies[event.datetime][tsdb.models.frequent_releases_by_group
                                        ][event.group_id][grouprelease.id] += 1

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
    repair_tag_data(caches, project, events)
    repair_group_release_data(caches, project, events)
    repair_tsdb_data(caches, project, events)

    for event in events:
        features.record([event])


def lock_hashes(project_id, source_id, fingerprints):
    with transaction.atomic():
        eligible_hashes = list(
            GroupHash.objects.filter(
                project_id=project_id,
                group_id=source_id,
                hash__in=fingerprints,
            ).exclude(
                state=GroupHash.State.LOCKED_IN_MIGRATION,
            ).select_for_update()
        )

        GroupHash.objects.filter(
            id__in=[h.id for h in eligible_hashes],
        ).update(state=GroupHash.State.LOCKED_IN_MIGRATION)

    return [h.hash for h in eligible_hashes]


def unlock_hashes(project_id, fingerprints):
    GroupHash.objects.filter(
        project_id=project_id,
        hash__in=fingerprints,
        state=GroupHash.State.LOCKED_IN_MIGRATION,
    ).update(state=GroupHash.State.UNLOCKED)


@instrumented_task(name='sentry.tasks.unmerge', queue='unmerge')
def unmerge(
    project_id,
    source_id,
    destination_id,
    fingerprints,
    actor_id,
    cursor=None,
    batch_size=500,
    source_fields_reset=False
):
    # XXX: The queryset chunking logic below is awfully similar to
    # ``RangeQuerySetWrapper``. Ideally that could be refactored to be able to
    # be run without iteration by passing around a state object and we could
    # just use that here instead.

    source = Group.objects.get(
        project_id=project_id,
        id=source_id,
    )

    # On the first iteration of this loop, we clear out all of the
    # denormalizations from the source group so that we can have a clean slate
    # for the new, repaired data.
    if cursor is None:
        fingerprints = lock_hashes(project_id, source_id, fingerprints)
        truncate_denormalizations(source)

    caches = get_caches()

    project = caches['Project'](project_id)

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
        tagstore.update_group_tag_key_values_seen(project_id, [source_id, destination_id])
        unlock_hashes(project_id, fingerprints)
        return destination_id

    Event.objects.bind_nodes(events, 'data')

    source_events = []
    destination_events = []

    for event in events:
        (destination_events
         if get_fingerprint(event) in fingerprints else source_events).append(event)

    if source_events:
        if not source_fields_reset:
            source.update(**get_group_creation_attributes(
                caches,
                source_events,
            ))
            source_fields_reset = True
        else:
            source.update(**get_group_backfill_attributes(
                caches,
                source,
                source_events,
            ))

    destination_id = migrate_events(
        caches,
        project,
        source_id,
        destination_id,
        fingerprints,
        destination_events,
        actor_id,
    )

    repair_denormalizations(
        caches,
        project,
        events,
    )

    unmerge.delay(
        project_id,
        source_id,
        destination_id,
        fingerprints,
        actor_id,
        cursor=events[-1].id,
        batch_size=batch_size,
        source_fields_reset=source_fields_reset,
    )
