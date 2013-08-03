"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import os.path

from sentry.constants import DATA_ROOT, PLATFORM_ROOTS
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

    data = Group.objects.normalize_event_data(data)
    return Group.objects.save_data(project.id, data, raw=True)
