"""
sentry.conf.urls
~~~~~~~~~~~~~~~~

These are additional urls used by the Sentry-provided web server

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import os

from django.contrib import admin

from sentry.web.urls import *


admin.autodiscover()
admin_media_dir = os.path.join(os.path.dirname(admin.__file__), 'media')

urlpatterns += patterns('',
    (r'^admin/', include(admin.site.urls)),
    url(r'^_admin_media/(?P<path>.*)$', generic.static_media,
        kwargs={'root': admin_media_dir},
        name='admin-media'),
)
