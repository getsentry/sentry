from __future__ import absolute_import

# import time
# from datetime import timedelta

# from django.db.models import Q
# from django.utils import timezone

# from sentry import options

# from sentry.api.event_search import convert_search_filter_to_snuba_query, InvalidSearchQuery
# from sentry.constants import ALLOWED_FUTURE_DELTA

# from sentry.models import Group, Release, GroupEnvironment
# from sentry.utils import metrics
from sentry.utils.services import Service

ANY = object()


class SearchBackend(Service):
    __read_methods__ = frozenset(["query"])
    __write_methods__ = frozenset()
    __all__ = __read_methods__ | __write_methods__

    def __init__(self, **options):
        pass

    def query(
        self,
        projects,
        tags=None,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        search_filters=None,
        date_from=None,
        date_to=None,
        **parameters
    ):
        raise NotImplementedError
