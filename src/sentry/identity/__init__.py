from __future__ import absolute_import

from .base import *  # NOQA
from .manager import IdentityManager  # NOQA
from .oauth2 import *  # NOQA

from .slack import *  # NOQA


default_manager = IdentityManager()
all = default_manager.all
get = default_manager.get
exists = default_manager.exists
register = default_manager.register
unregister = default_manager.unregister
