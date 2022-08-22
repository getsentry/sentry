from typing import Any, Callable, Mapping, Tuple

from sentry.utils.cursors import CursorResult

"""TODO(mgaeta): This directory is incorrectly suffixed '_index'."""

# Bulk mutations are limited to 1000 items.
# TODO(dcramer): It'd be nice to support more than this, but it's a bit too
#  complicated right now.
BULK_MUTATION_LIMIT = 1000

ACTIVITIES_COUNT = 100

# XXX: The 1000 magic number for `max_hits` is an abstraction leak from
#  `sentry.api.paginator.BasePaginator.get_result`.
SEARCH_MAX_HITS = 1000

SearchFunction = Callable[[Mapping[str, Any]], Tuple[CursorResult, Mapping[str, Any]]]

__all__ = (
    "ACTIVITIES_COUNT",
    "BULK_MUTATION_LIMIT",
    "SEARCH_MAX_HITS",
    "delete_group_list",
    "update_groups",
)

from .delete import *  # NOQA
from .delete import delete_group_list
from .index import *  # NOQA
from .update import *  # NOQA
from .update import update_groups
