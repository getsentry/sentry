"""TODO(mgaeta): This directory is incorrectly suffixed '_index'."""

# Bulk mutations are limited to 1000 items.
# TODO(dcramer): It'd be nice to support more than this, but it's a bit too
#  complicated right now.
BULK_MUTATION_LIMIT = 1000

from .delete import *  # NOQA
from .index import *  # NOQA
from .update import *  # NOQA
