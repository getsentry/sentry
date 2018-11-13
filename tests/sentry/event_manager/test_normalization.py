from __future__ import absolute_import

import mock
import logging

from django.conf import settings

from sentry.constants import MAX_CULPRIT_LENGTH, DEFAULT_LOGGER_NAME
from sentry.event_manager import EventManager


def make_event(**kwargs):
    result = {
        'event_id': 'a' * 32,
        'message': 'foo',
        'timestamp': 1403007314.570599,
        'level': logging.ERROR,
        'logger': 'default',
        'tags': [],
    }
    result.update(kwargs)
    return result


def test_tags_as_list():
    manager = EventManager(make_event(tags=[('foo', 'bar')]))
    manager.normalize()
    data = manager.get_data()

    assert data['tags'] == [('foo', 'bar')]


def test_tags_as_dict():
    manager = EventManager(make_event(tags={'foo': 'bar'}))
    manager.normalize()
    data = manager.get_data()

    assert data['tags'] == [('foo', 'bar')]


def test_interface_is_relabeled():
    manager = EventManager(make_event(user={'id': '1'}))
    manager.normalize()
    data = manager.get_data()

    assert data['user'] == {'id': '1'}
    # data is a CanonicalKeyDict, so we need to check .keys() explicitly
    assert 'sentry.interfaces.User' not in data.keys()


def test_does_default_ip_address_to_user():
    manager = EventManager(
        make_event(
            **{
                'sentry.interfaces.Http': {
                    'url': 'http://example.com',
                    'env': {
                        'REMOTE_ADDR': '127.0.0.1',
                    }
                }
            }
        )
    )
    manager.normalize()
    data = manager.get_data()

    assert data['sentry.interfaces.User']['ip_address'] == '127.0.0.1'


@mock.patch('sentry.interfaces.geo.Geo.from_ip_address')
def test_does_geo_from_ip(from_ip_address_mock):
    from sentry.interfaces.geo import Geo

    geo = {
        'city': 'San Francisco',
        'country_code': 'US',
        'region': 'CA',
    }
    from_ip_address_mock.return_value = Geo.to_python(geo)

    manager = EventManager(
        make_event(
            **{
                'sentry.interfaces.User': {
                    'ip_address': '192.168.0.1',
                },
            }
        )
    )

    manager.normalize()
    data = manager.get_data()
    assert data['sentry.interfaces.User']['ip_address'] == '192.168.0.1'
    assert data['sentry.interfaces.User']['geo'] == geo


@mock.patch('sentry.interfaces.geo.geo_by_addr')
def test_skips_geo_with_no_result(geo_by_addr_mock):
    geo_by_addr_mock.return_value = None

    manager = EventManager(
        make_event(
            **{
                'sentry.interfaces.User': {
                    'ip_address': '127.0.0.1',
                },
            }
        )
    )
    manager.normalize()
    data = manager.get_data()
    assert data['sentry.interfaces.User']['ip_address'] == '127.0.0.1'
    assert 'geo' not in data['sentry.interfaces.User']


def test_does_default_ip_address_if_present():
    manager = EventManager(
        make_event(
            **{
                'sentry.interfaces.Http': {
                    'url': 'http://example.com',
                    'env': {
                        'REMOTE_ADDR': '127.0.0.1',
                    }
                },
                'sentry.interfaces.User': {
                    'ip_address': '192.168.0.1',
                },
            }
        )
    )
    manager.normalize()
    data = manager.get_data()
    assert data['sentry.interfaces.User']['ip_address'] == '192.168.0.1'


def test_long_culprit():
    manager = EventManager(make_event(
        culprit='x' * (MAX_CULPRIT_LENGTH + 1),
    ))
    manager.normalize()
    data = manager.get_data()
    assert len(data['culprit']) == MAX_CULPRIT_LENGTH


def test_long_transaction():
    manager = EventManager(make_event(
        transaction='x' * (MAX_CULPRIT_LENGTH + 1),
    ))
    manager.normalize()
    data = manager.get_data()
    assert len(data['transaction']) == MAX_CULPRIT_LENGTH


def test_long_message():
    manager = EventManager(
        make_event(
            message='x' * (settings.SENTRY_MAX_MESSAGE_LENGTH + 1),
        )
    )
    manager.normalize()
    data = manager.get_data()
    assert len(data['sentry.interfaces.Message']['message']) == \
        settings.SENTRY_MAX_MESSAGE_LENGTH


def test_default_version():
    manager = EventManager(make_event())
    manager.normalize()
    data = manager.get_data()
    assert data['version'] == '5'


def test_explicit_version():
    manager = EventManager(make_event(), '6')
    manager.normalize()
    data = manager.get_data()
    assert data['version'] == '6'


def test_logger():
    manager = EventManager(make_event(logger="foo\nbar"))
    manager.normalize()
    data = manager.get_data()
    assert data['logger'] == DEFAULT_LOGGER_NAME

    manager = EventManager(make_event(logger=""))
    manager.normalize()
    data = manager.get_data()
    assert data['logger'] == DEFAULT_LOGGER_NAME
    assert not any(e.get('name') == 'logger' for e in data['errors'])


def test_bad_interfaces_no_exception():
    manager = EventManager(
        make_event(
            **{
                'sentry.interfaces.User': None,
                'sentry.interfaces.Http': None,
                'sdk': 'A string for sdk is not valid'
            }
        ),
        client_ip='1.2.3.4'
    )
    manager.normalize()

    manager = EventManager(
        make_event(
            **{
                'errors': {},
                'sentry.interfaces.Http': {},
            }
        )
    )
    manager.normalize()


def test_event_pii():
    manager = EventManager(
        make_event(
            message='foo bar',
            _meta={'message': {'': {'err': ['invalid']}}},
        )
    )
    manager.normalize()
    data = manager.get_data()
    assert data['_meta']['message'] == {'': {'err': ['invalid']}}
