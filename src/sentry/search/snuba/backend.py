from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry.event_manager import ALLOWED_FUTURE_DELTA
from sentry.models import Release, Group, GroupEnvironment
from sentry.search.django.backend import (
    DjangoSearchBackend, QuerySetBuilder, CallbackCondition, get_sql_column
)


class SnubaSearchBackend(DjangoSearchBackend):
    def _query(self, project, retention_window_start, group_queryset, tags, environment,
               sort_by, limit, cursor, count_hits, paginator_options, **parameters):

        now = timezone.now()
        end = parameters.get('date_to') or (now + ALLOWED_FUTURE_DELTA)
        # TODO: Presumably we want to search back to the project's full retention,
        #       which may be higher than 90 days in the future, but apparently
        #       `retention_window_start` can be None?
        start = (parameters.get('date_from')
                 or retention_window_start
                 or (now - timedelta(days=90)))

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environment is not None:
            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.extra(
                        where=[
                            '{} = {}'.format(
                                get_sql_column(GroupEnvironment, 'first_release_id'),
                                get_sql_column(Release, 'id'),
                            ),
                            '{} = %s'.format(
                                get_sql_column(Release, 'organization'),
                            ),
                            '{} = %s'.format(
                                get_sql_column(Release, 'version'),
                            ),
                        ],
                        params=[project.organization_id, version],
                        tables=[Release._meta.db_table],
                    ),
                ),
            }).build(
                group_queryset.extra(
                    where=[
                        '{} = {}'.format(
                            get_sql_column(Group, 'id'),
                            get_sql_column(GroupEnvironment, 'group_id'),
                        ),
                        '{} = %s'.format(
                            get_sql_column(GroupEnvironment, 'environment_id'),
                        ),
                    ],
                    params=[environment.id],
                    tables=[GroupEnvironment._meta.db_table],
                ),
                parameters,
            )
        else:
            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=project.organization_id,
                        first_release__version=version,
                    ),
                ),
            }).build(
                group_queryset,
                parameters,
            )

        # TODO: If the query didn't include anything to significantly filter
        # down the number of groups at this point ('first_release', 'query',
        # 'status', 'bookmarked_by', 'assigned_to', 'unassigned',
        # 'subscribed_by', 'active_at_from', or 'active_at_to') then this
        # queryset might return a *huge* number of groups. In this case, we
        # probably *don't* want to pass candidates down to Snuba, and rather we
        # want Snuba to do all the filtering/sorting it can and *then* apply
        # this queryset to the results from Snuba.
        #
        # However, if this did filter down the number of groups siginicantly,
        # then passing in candidates is, of course, valueable.
        #
        # Should we decide which way to handle it based on the number of
        # group_ids, the number of hashes? Or should we just always start the
        # query with Snuba? Something else?
        group_ids = list(group_queryset.values_list('id', flat=True))

        results = do_search(
            project.id,
            environment and environment.id,
            tags,
            start,
            end,
            candidates=group_ids,
        )

        from pprint import pprint
        pprint(results)

        # TODO:
        # * Using `group_queryset` as starting candidates, search snuba to filter/sort
        #   the rest of the parameters.
        # * Snuba needs to filter on: times_seen, age_from/to, last_seen_from/to, tags, environment
        # * Snuba needs to return a sorting score (for paginating with a cursor):
        #     priority: log(times_seen) * 600 + last_seen::abstime::int
        #     date: last_seen
        #     new: first_seen
        #     freq: times_seen
        # * Use a `SequencePaginator` to order the Group IDs
        # * Fetch the actual Group objects in bulk based on the paginator results

        return []


def do_search(project_id, environment_id, tags, start, end, candidates=None, limit=1000):
    import six
    from sentry.utils import snuba
    from sentry.search.base import ANY
    from sentry.models import GroupHash

    filters = {
        'project_id': [project_id],
    }

    if environment_id is not None:
        filters['environment'] = [environment_id]

    if candidates:
        hashes = list(
            GroupHash.objects.filter(
                group_id__in=candidates
            ).values_list(
                'hash', flat=True
            ).distinct()
        )

        if not hashes:
            return []

        filters['primary_hash'] = hashes

    conditions = []
    for tag, val in six.iteritems(tags):
        col = 'tags[{}]'.format(tag)
        if val == ANY:
            conditions.append((col, '!=', ''))
        else:
            conditions.append((col, '=', val))

    hashes = snuba.query(start, end, ['primary_hash'], conditions, filters)

    group_ids = GroupHash.objects.filter(
        project_id=project_id, hash__in=hashes.keys()
    ).values_list('group_id', flat=True).distinct()

    return group_ids
