from __future__ import absolute_import, print_function

from .manager import ProviderManager

manager = ProviderManager()
register = manager.register
unregister = manager.unregister
