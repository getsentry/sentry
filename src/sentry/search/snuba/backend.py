from __future__ import absolute_import

from sentry.search.django.backend import (
    DjangoSearchBackend, QuerySetBuilder, CallbackCondition, ScalarCondition,
    get_sort_clause, sort_strategies
)
from sentry import tagstore


class SnubaSearchBackend(DjangoSearchBackend):
    def _query(self, project, start, end, retention_window_start, group_queryset, tags=None,
               environment=None, sort_by='date', limit=100, cursor=None, count_hits=False,
               paginator_options=None, **parameters):

        if not (tags or
                environment is not None or
                any(key in parameters for key in ('date_from', 'date_to'))):

            # Snuba can't do any additional filtering here, fallback to plain DjangoSearchBackend
            super(SnubaSearchBackend, self)._query(
                project, start, end, retention_window_start, group_queryset, tags,
                environment, sort_by, limit, cursor, count_hits, paginator_options,
                **parameters
            )

        group_ids = tagstore.get_group_ids_for_search_filter(
            project.id,
            environment and environment.id,
            tags,
            start,
            end,
        )

        group_queryset = group_queryset.filter(id__in=group_ids)
        group_queryset = QuerySetBuilder({
            'first_release': CallbackCondition(
                lambda queryset, version: queryset.filter(
                    first_release__organization_id=project.organization_id,
                    first_release__version=version,
                ),
            ),
            'age_from': ScalarCondition('first_seen', 'gt'),
            'age_to': ScalarCondition('first_seen', 'lt'),
            'last_seen_from': ScalarCondition('last_seen', 'gt'),
            'last_seen_to': ScalarCondition('last_seen', 'lt'),
            'times_seen': CallbackCondition(
                lambda queryset, times_seen: queryset.filter(times_seen=times_seen),
            ),
            'times_seen_lower': ScalarCondition('times_seen', 'gt'),
            'times_seen_upper': ScalarCondition('times_seen', 'lt'),
        }).build(
            group_queryset,
            parameters,
        ).extra(
            select={
                'sort_value': get_sort_clause(sort_by),
            },
        )

        paginator_cls, sort_clause = sort_strategies[sort_by]
        group_queryset = group_queryset.order_by(sort_clause)
        paginator = paginator_cls(group_queryset, sort_clause, **paginator_options)
        return paginator.get_result(limit, cursor, count_hits=count_hits)
