from __future__ import absolute_import

import os
import subprocess
import pytest

from sentry.testutils.factories import Factories


class BugCatcher(object):
    def __init__(self, live_server):
        self.live_server = live_server

    def run(self, as_user=None):
        args = [
            os.path.join(os.path.dirname(__file__), os.pardir, 'node_modules', '.bin', 'inhuman'),
            self.live_server.url + '/',
            '--screenshots', '.artifacts/screenshots/',
            '--wait-until', 'networkidle0',
            '--block', '/manage/quotas',
        ]
        if as_user:
            args.extend([
                '--username', as_user.username,
                '--password', 'admin',
            ])
        subprocess.check_call(args, env=os.environ)


@pytest.fixture
def magic(db, live_server, default_user):
    from django.conf import settings
    # this is def gonna be unstable/hacky
    import sentry
    settings.SENTRY_OPTIONS['system.url-prefix'] = live_server.url
    settings.SENTRY_OPTIONS['beacon.anonymous'] = True
    settings.SENTRY_OPTIONS['sentry:version-configured'] = sentry.get_version()
    settings.SENTRY_OPTIONS['system.admin-email'] = default_user.email
    return BugCatcher(live_server)


def test_boring_user(magic, default_user, default_group, default_event):
    user = Factories.create_user(is_superuser=False)
    magic.run(as_user=user)


def test_superuser(magic, default_user, default_group, default_event):
    magic.run(as_user=default_user)
