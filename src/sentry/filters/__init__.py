from __future__ import absolute_import, print_function

__all__ = [
    'Filter', 'FilterManager', 'FilterNotRegistered', 'all', 'exists', 'get',
    'register', 'unregister'
]

from .base import Filter  # NOQA
from .manager import FilterManager  # NOQA

from .localhost import LocalhostFilter
from .browser_extensions import BrowserExtensionsFilter
from .legacy_browsers import LegacyBrowsersFilter
from .web_crawlers import WebCrawlersFilter

default_manager = FilterManager()
default_manager.register(LocalhostFilter)
default_manager.register(BrowserExtensionsFilter)
default_manager.register(LegacyBrowsersFilter)
default_manager.register(WebCrawlersFilter)

all = default_manager.all
exists = default_manager.exists
get = default_manager.get
register = default_manager.register
unregister = default_manager.unregister
