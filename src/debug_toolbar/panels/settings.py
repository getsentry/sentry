from __future__ import absolute_import, unicode_literals

from django.conf import settings
from django.views.debug import get_safe_settings
from django.utils.translation import ugettext_lazy as _

from debug_toolbar.compat import OrderedDict
from debug_toolbar.panels import Panel


class SettingsPanel(Panel):
    """
    A panel to display all variables in django.conf.settings
    """
    template = 'debug_toolbar/panels/settings.html'

    nav_title = _("Settings")

    def title(self):
        return _("Settings from <code>%s</code>") % settings.SETTINGS_MODULE

    def process_response(self, request, response):
        self.record_stats({
            'settings': OrderedDict(sorted(get_safe_settings().items(),
                                           key=lambda s: s[0])),
        })
