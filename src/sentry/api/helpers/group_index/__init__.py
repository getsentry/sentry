from .delete import delete_group_list

"""TODO(mgaeta): This directory is incorrectly suffixed '_index'."""

# Bulk mutations are limited to 1000 items.
# TODO(dcramer): It'd be nice to support more than this, but it's a bit too
#  complicated right now.
BULK_MUTATION_LIMIT = 1000

ACTIVITIES_COUNT = 100

# XXX: The 1000 magic number for `max_hits` is an abstraction leak from
#  `sentry.api.paginator.BasePaginator.get_result`.
SEARCH_MAX_HITS = 1000

__all__ = (
    "ACTIVITIES_COUNT",
    "BULK_MUTATION_LIMIT",
    "SEARCH_MAX_HITS",
    "delete_group_list",
)

from .delete import *  # NOQA
from .index import *  # NOQA
from .update import *  # NOQA
