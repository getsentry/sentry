"""
sentry.projectoptions
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2019 by the sentry team, see authors for more details.
:license: bsd, see license for more details.
"""
from __future__ import absolute_import, print_function

from .manager import ProjectOptionsManager

__all__ = ('get', 'set', 'delete', 'register', 'isset', 'lookup_key')

default_manager = ProjectOptionsManager()

# expose public api
get = default_manager.get
set = default_manager.set
delete = default_manager.delete
register = default_manager.register
all = default_manager.all
isset = default_manager.isset
lookup_well_known_key = default_manager.lookup_well_known_key

# epochs
OLDEST_EPOCH = 1
LATEST_EPOCH = 2

from . import defaults  # NOQA
