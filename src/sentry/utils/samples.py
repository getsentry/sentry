"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os.path
from datetime import datetime, timedelta

from sentry.constants import DATA_ROOT
from sentry.event_manager import EventManager
from sentry.utils import json

epoch = datetime.utcfromtimestamp(0)


def milliseconds_ago(now, milliseconds):
    ago = (now - timedelta(milliseconds=milliseconds))
    return (ago - epoch).total_seconds()


def load_data(platform, default=None):
    # NOTE: Before editing this data, make sure you understand the context
    # in which its being used. It is NOT only used for local development and
    # has production consequences.
    #   * bin/load-mocks to generate fake data for local testing
    #   * When a new project is created, a fake event is generated as a "starter"
    #     event so it's not an empty project.
    #   * When a user clicks Test Configuration from notification plugin settings page,
    #     a fake event is generated to go through the pipeline.

    # now = datetime.now()

    data = None
    for platform in (platform, default):
        if platform is None:
            continue

        json_path = os.path.join(DATA_ROOT, 'samples', '%s.json' % (platform.encode('utf-8'),))

        if not os.path.exists(json_path):
            continue

        with open(json_path) as fp:
            data = json.loads(fp.read())
            break

    if data is None:
        return

    if platform == 'csp':
        return data

    data['platform'] = platform
    data['message'] = 'This is an example %s exception' % (platform,)
    data['sentry.interfaces.User'] = {
        "username": "getsentry",
        "id": "1671",
        "email": "foo@example.com"
    }
    data['extra'] = {
        'session': {
            'foo': 'bar',
        },
        'results': [1, 2, 3, 4, 5],
        'emptyList': [],
        'emptyMap': {},
        'length': 10837790,
        'unauthorized': False,
        'url': 'http://example.org/foo/bar/',
    }
    data['modules'] = {
        'my.package': '1.0.0',
    }
    data['sentry.interfaces.Http'] = {
        "cookies": 'foo=bar;biz=baz',
        "url": "http://example.com/foo",
        "headers": {
            "Referer": "http://example.com",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36"
        },
        "env": {
            'ENV': 'prod',
        },
        "query_string": "foo=bar",
        "data": '{"hello": "world"}',
        "method": "GET"
    }

    # We can't send Breadcrumb data as a part of the sample event.
    # This gets used for all new projects as the "starter" event.
    #
    # data['sentry.interfaces.Breadcrumbs'] = {
    #     "values": [
    #         {
    #             "type": "navigation",
    #             "dt": 8200,
    #             "timestamp": milliseconds_ago(now, 5200),
    #             "data": {
    #                 "to": "http://example.com/dashboard/",
    #                 "from": "http://example.com/login/"
    #             }
    #         },
    #         {
    #             "type": "message",
    #             "dt": 5000,
    #             "timestamp": milliseconds_ago(now, 4000),
    #             "data": {
    #                 "message": "This is a message breadcrumb",
    #                 "level": "info"
    #             }
    #         },
    #         {
    #             "type": "message",
    #             "dt": 4000,
    #             "timestamp": milliseconds_ago(now, 3300),
    #             "data": {
    #                 "message": "This is a warning message",
    #                 "level": "warning"
    #             }
    #         },
    #         {
    #             "type": "message",
    #             "dt": 3500,
    #             "timestamp": milliseconds_ago(now, 2700),
    #             "data": {
    #                 "message": "This is an error message",
    #                 "level": "error"
    #             }
    #         },
    #         {
    #             "type": "http_request",
    #             "dt": 3000,
    #             "timestamp": milliseconds_ago(now, 1300),
    #             "data": {
    #                 "url": "http://example.com/foo",
    #                 "statusCode": 200,
    #                 "method": "POST",
    #                 "headers": {
    #                     "Referer": "http://example.com",
    #                     "Content-Type": "application/json"
    #                 }
    #             }
    #         },
    #         {
    #             "type": "ui_event",
    #             "dt": 1500,
    #             "timestamp": milliseconds_ago(now, 1000),
    #             "data": {
    #                 "type": "click",
    #                 "target": "<button name=\"submit\" class=\"btn btn-small\"/>"
    #             }
    #         }
    #     ]
    # }

    return data


def create_sample_event(project, platform=None, default=None, raw=True,
                        **kwargs):
    if not platform and not default:
        return

    if platform:
        platform = platform.split('-', 1)[0].split('_', 1)[0]

    data = load_data(platform, default)

    if not data:
        return

    data.update(kwargs)

    manager = EventManager(data)
    manager.normalize()
    return manager.save(project.id, raw=raw)
