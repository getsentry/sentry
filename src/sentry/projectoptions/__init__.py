from __future__ import absolute_import, print_function

from .manager import ProjectOptionsManager

default_manager = ProjectOptionsManager()

# expose public api
get = default_manager.get
set = default_manager.set
delete = default_manager.delete
register = default_manager.register
all = default_manager.all
isset = default_manager.isset
lookup_well_known_key = default_manager.lookup_well_known_key
update_rev_for_option = default_manager.update_rev_for_option


def get_well_known_default(key, project=None, epoch=None):
    """Utility function to return the default for a well known key."""
    well_known_key = lookup_well_known_key(key)
    if well_known_key is not None:
        return well_known_key.get_default(project=project, epoch=epoch)


from . import defaults  # NOQA
from .defaults import LATEST_EPOCH  # NOQA
