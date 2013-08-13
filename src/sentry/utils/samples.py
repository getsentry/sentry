"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import os.path

from sentry.constants import DATA_ROOT, PLATFORM_ROOTS, PLATFORM_TITLES
from sentry.models import Group
from sentry.utils import json


def create_sample_event(project, platform=None):
    if not platform:
        platform = project.platform

    if not platform:
        return

    platform = PLATFORM_ROOTS.get(platform, platform)

    json_path = os.path.join(DATA_ROOT, 'samples', '%s.json' % (platform.encode('utf-8'),))

    if not os.path.exists(json_path):
        return

    with open(json_path) as fp:
        data = json.loads(fp.read())

    data['platform'] = platform
    data['message'] = 'This is an example %s exception' % (
        PLATFORM_TITLES.get(platform, platform.title()),)
    data['sentry.interfaces.User'] = {
        "username": "getsentry",
        "id": "1671",
        "email": "foo@example.com"
    }
    data['sentry.interfaces.Http'] = {
        "cookies": {},
        "url": "http://example.com/foo",
        "headers": {
            "Referer": "http://example.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36"
        },
        "env": {},
        "query_string": "",
        "data": {},
        "method": "GET"
    }
    data = Group.objects.normalize_event_data(data)
    return Group.objects.save_data(project.id, data, raw=True)
