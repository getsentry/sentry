from __future__ import absolute_import

import os
import subprocess


def test_the_magic(db, live_server, default_user, default_group, default_event):
    from django.conf import settings
    # this is def gonna be unstable/hacky
    settings.SENTRY_OPTIONS['system.url-prefix'] = live_server.url
    cmd = os.path.join(os.path.dirname(__file__), os.pardir, 'bin', 'bug-catcher')
    subprocess.check_call([
        cmd,
        '--url', live_server.url + '/',
        '--username', default_user.username,
        '--password', 'admin',
    ], env=os.environ)
