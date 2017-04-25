"""
sentry.utils.samples
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os.path
import random
from datetime import datetime, timedelta

import six

from sentry.constants import DATA_ROOT
from sentry.event_manager import EventManager
from sentry.interfaces.user import User as UserInterface
from sentry.utils import json

epoch = datetime.utcfromtimestamp(0)


def milliseconds_ago(now, milliseconds):
    ago = (now - timedelta(milliseconds=milliseconds))
    return (ago - epoch).total_seconds()


def random_ip():
    not_valid = [10, 127, 169, 172, 192]

    first = random.randrange(1, 256)
    while first in not_valid:
        first = random.randrange(1, 256)

    return '.'.join((
        six.text_type(first),
        six.text_type(random.randrange(1, 256)),
        six.text_type(random.randrange(1, 256)),
        six.text_type(random.randrange(1, 256))
    ))


def random_username():
    return random.choice([
        'jess', 'david', 'chris', 'eric', 'katie', 'ben', 'armin', 'saloni',
        'max', 'meredith', 'matt', 'sentry',
    ])


def name_for_username(username):
    return {
        'ben': 'Ben Vinegar',
        'chris': 'Chris Jennings',
        'david': 'David Cramer',
        'matt': 'Matt Robenolt',
        'jess': 'Jess MacQueen',
        'katie': 'Katie Lundsgaard',
        'saloni': 'Saloni Dudziak',
        'max': 'Max Bittker',
        'meredith': 'Meredith Heller',
        'eric': 'Eric Feng',
        'armin': 'Armin Ronacher',
    }.get(username, username.replace('_', ' ').title())


def generate_user(username=None, email=None, ip_address=None, id=None):
    if username is None and email is None:
        username = random_username()
        email = '{}@example.com'.format(username)
    return UserInterface.to_python({
        'id': id,
        'username': username,
        'email': email,
        'ip_address': ip_address or random_ip(),
        'name': name_for_username(username),
    }).to_json()


def load_data(platform, default=None, timestamp=None, sample_name=None):
    # NOTE: Before editing this data, make sure you understand the context
    # in which its being used. It is NOT only used for local development and
    # has production consequences.
    #   * bin/load-mocks to generate fake data for local testing
    #   * When a new project is created, a fake event is generated as a "starter"
    #     event so it's not an empty project.
    #   * When a user clicks Test Configuration from notification plugin settings page,
    #     a fake event is generated to go through the pipeline.
    sample_name = sample_name or platform

    data = None
    for platform in (platform, default):
        if platform is None:
            continue

        json_path = os.path.join(DATA_ROOT, 'samples', '%s.json' % (sample_name.encode('utf-8'),))

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
    data['message'] = 'This is an example %s exception' % (sample_name,)
    data['sentry.interfaces.User'] = generate_user(
        ip_address='127.0.0.1',
        username='sentry',
        id=1,
        email='sentry@example.com',
    )
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

    start = datetime.utcnow()
    if timestamp:
        try:
            start = datetime.utcfromtimestamp(timestamp)
        except TypeError:
            pass

    # Make breadcrumb timestamps relative to right now so they make sense
    breadcrumbs = data.get('sentry.interfaces.Breadcrumbs')
    if breadcrumbs is not None:
        duration = 1000
        values = breadcrumbs['values']
        for value in reversed(values):
            value['timestamp'] = milliseconds_ago(start, duration)

            # Every breadcrumb is 1s apart
            duration += 1000

    return data


def create_sample_event(project, platform=None, default=None, raw=True,
                        sample_name=None, **kwargs):
    if not platform and not default:
        return

    timestamp = kwargs.get('timestamp')

    data = load_data(platform, default, timestamp, sample_name)

    if not data:
        return

    data.update(kwargs)

    manager = EventManager(data)
    manager.normalize()
    return manager.save(project.id, raw=raw)
