from __future__ import absolute_import, print_function

from .provider import *  # NOQA
from .manager import ProviderManager
from .view import *  # NOQA

manager = ProviderManager()
register = manager.register
unregister = manager.unregister

# TODO(dcramer): move this into external plugin
from .providers.google_oauth2 import GoogleOAuth2Provider
register('google', GoogleOAuth2Provider)
