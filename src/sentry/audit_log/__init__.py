from .manager import *  # NOQA
from .register import default_manager  # NOQA

# expose public api

add = default_manager.add
get = default_manager.get
get_event_id = default_manager.get_event_id
get_api_names = default_manager.get_api_names
