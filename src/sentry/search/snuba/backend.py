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

        start  # TODO
        end  # TODO

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

        # TODO:
        # * Using `group_queryset` as starting candidates, search snuba to filter/sort
        #   the rest of the parameters.
        # * Snuba needs to filter on: times_seen, age_from/to, last_seen_from/to, tags, environment
        # * Snuba needs to sort by: times_seen, priority (function of times_seen), last_seen, first_seen
        # * Use a `SequencePaginator` to order the Group IDs
        # * Fetch the actual Group objects in bulk based on the paginator results

        return []
