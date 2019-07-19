from __future__ import absolute_import, print_function

from .bindings import BindingManager
from .manager import PluginManager
from .notifier import *  # NOQA
from .response import *  # NOQA
from .structs import *  # NOQA
from .v1 import *  # NOQA
from .v2 import *  # NOQA

bindings = BindingManager()

plugins = PluginManager()
register = plugins.register
unregister = plugins.unregister
