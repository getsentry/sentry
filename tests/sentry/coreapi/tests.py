# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from datetime import datetime
from uuid import UUID

from sentry.coreapi import (
    APIError, APIUnauthorized, Auth, ClientApiHelper, InvalidTimestamp,
    get_interface
)
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
    def setUp(self):
        self.user = self.create_user('coreapi@example.com')
        self.team = self.create_team(name='Foo')
        self.project = self.create_project(team=self.team)
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create()[0]
        self.helper = ClientApiHelper()


class AuthFromRequestTest(BaseAPITest):
    def test_valid(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'Sentry sentry_key=value, biz=baz'}
        result = self.helper.auth_from_request(request)
        assert result.public_key == 'value'

    def test_invalid_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_X_SENTRY_AUTH': 'foobar'}
        request.GET = {'sentry_version': '1', 'foo': 'bar'}
        result = self.helper.auth_from_request(request)
        assert result.version == '1'

    def test_invalid_legacy_header_defers_to_GET(self):
        request = mock.Mock()
        request.META = {'HTTP_AUTHORIZATION': 'foobar'}
        request.GET = {'sentry_version': '1', 'foo': 'bar'}
        result = self.helper.auth_from_request(request)
        assert result.version == '1'


class ProjectFromAuthTest(BaseAPITest):
    def test_invalid_if_missing_key(self):
        self.assertRaises(APIUnauthorized, self.helper.project_from_auth, Auth({}))

    def test_valid_with_key(self):
        auth = Auth({'sentry_key': self.pk.public_key})
        result = self.helper.project_from_auth(auth)
        self.assertEquals(result, self.project)

    def test_invalid_key(self):
        auth = Auth({'sentry_key': 'z'})
        self.assertRaises(APIUnauthorized, self.helper.project_from_auth, auth)

    def test_invalid_secret(self):
        auth = Auth({'sentry_key': self.pk.public_key, 'sentry_secret': 'z'})
        self.assertRaises(APIUnauthorized, self.helper.project_from_auth, auth)


class ProcessDataTimestampTest(BaseAPITest):
    def test_iso_timestamp(self):
        d = datetime(2012, 01, 01, 10, 30, 45)
        data = self.helper._process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45'
        }, current_datetime=d)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], 1325413845.0)

    def test_iso_timestamp_with_ms(self):
        d = datetime(2012, 01, 01, 10, 30, 45, 434000)
        data = self.helper._process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45.434'
        }, current_datetime=d)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], 1325413845.0)

    def test_timestamp_iso_timestamp_with_Z(self):
        d = datetime(2012, 01, 01, 10, 30, 45)
        data = self.helper._process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45Z'
        }, current_datetime=d)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], 1325413845.0)

    def test_invalid_timestamp(self):
        self.assertRaises(InvalidTimestamp, self.helper._process_data_timestamp, {
            'timestamp': 'foo'
        })

    def test_invalid_numeric_timestamp(self):
        self.assertRaises(InvalidTimestamp, self.helper._process_data_timestamp, {
            'timestamp': '100000000000000000000.0'
        })

    def test_future_timestamp(self):
        self.assertRaises(InvalidTimestamp, self.helper._process_data_timestamp, {
            'timestamp': '2052-01-01T10:30:45Z'
        })

    def test_long_microseconds_value(self):
        d = datetime(2012, 01, 01, 10, 30, 45)
        data = self.helper._process_data_timestamp({
            'timestamp': '2012-01-01T10:30:45.341324Z'
        }, current_datetime=d)
        self.assertTrue('timestamp' in data)
        self.assertEquals(data['timestamp'], 1325413845.0)


class ValidateDataTest(BaseAPITest):
    def test_missing_project_id(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
        })
        assert data['project'] == self.project.id

    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_empty_event_id(self, uuid4):
        data = self.helper.validate_data(self.project, {
            'event_id': '',
        })
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'

    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_missing_event_id(self, uuid4):
        data = self.helper.validate_data(self.project, {})
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'

    @mock.patch('uuid.uuid4', return_value=UUID('031667ea1758441f92c7995a428d2d14'))
    def test_invalid_event_id(self, uuid4):
        data = self.helper.validate_data(self.project, {
            'event_id': 'a' * 33,
        })
        assert data['event_id'] == '031667ea1758441f92c7995a428d2d14'
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'event_id'
        assert data['errors'][0]['value'] == 'a' * 33

    def test_invalid_event_id_raises(self):
        self.assertRaises(APIError, self.helper.validate_data, self.project, {
            'event_id': 1
        })

    def test_unknown_attribute(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'foo': 'bar',
        })
        assert 'foo' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'foo'

    def test_invalid_interface_name(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'foo.baz': 'bar',
        })
        assert 'foo.baz' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'foo.baz'

    def test_invalid_interface_import_path(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'sentry.interfaces.Exception2': 'bar',
        })
        assert 'sentry.interfaces.Exception2' not in data
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_attribute'
        assert data['errors'][0]['name'] == 'sentry.interfaces.Exception2'

    def test_does_expand_list(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'exception': [{
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
            }]
        })
        assert 'sentry.interfaces.Exception' in data

    def test_log_level_as_string(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'level': 'error',
        })
        assert data['level'] == 40

    def test_invalid_log_level(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'level': 'foobar',
        })
        assert data['level'] == 40
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'level'
        assert data['errors'][0]['value'] == 'foobar'

    def test_tags_as_string(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'tags': 'bar',
        })
        assert 'tags' not in data

    def test_tags_out_of_bounds(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'tags': {'f' * 33: 'value', 'foo': 'v' * 201, 'bar': 'value'},
        })
        assert data['tags'] == [('bar', 'value')]
        assert len(data['errors']) == 2

    def test_tags_as_invalid_pair(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'tags': [('foo', 'bar'), ('biz', 'baz', 'boz')],
        })
        assert data['tags'] == [('foo', 'bar')]
        assert len(data['errors']) == 1
        assert data['errors'][0]['type'] == 'invalid_data'
        assert data['errors'][0]['name'] == 'tags'
        assert data['errors'][0]['value'] == ('biz', 'baz', 'boz')

    def test_extra_as_string(self):
        data = self.helper.validate_data(self.project, {
            'message': 'foo',
            'extra': 'bar',
        })
        assert 'extra' not in data

    def test_invalid_culprit_raises(self):
        self.assertRaises(APIError, self.helper.validate_data, self.project, {
            'culprit': 1
        })


class GetInterfaceTest(TestCase):
    def test_does_not_let_through_disallowed_name(self):
        with self.assertRaises(ValueError):
            get_interface('subprocess')

    def test_allows_http(self):
        from sentry.interfaces.http import Http
        result = get_interface('sentry.interfaces.Http')
        assert result is Http
        result = get_interface('request')
        assert result is Http


class EnsureHasIpTest(BaseAPITest):
    def test_with_remote_addr(self):
        inp = {
            'sentry.interfaces.Http': {
                'env': {
                    'REMOTE_ADDR': '192.168.0.1',
                },
            },
        }
        out = inp.copy()
        self.helper.ensure_has_ip(out, '127.0.0.1')
        assert inp == out

    def test_with_user_ip(self):
        inp = {
            'sentry.interfaces.User': {
                'ip_address': '192.168.0.1',
            },
        }
        out = inp.copy()
        self.helper.ensure_has_ip(out, '127.0.0.1')
        assert inp == out

    def test_without_ip_values(self):
        out = {
            'sentry.interfaces.User': {
            },
            'sentry.interfaces.Http': {
                'env': {},
            },
        }
        self.helper.ensure_has_ip(out, '127.0.0.1')
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'

    def test_without_any_values(self):
        out = {}
        self.helper.ensure_has_ip(out, '127.0.0.1')
        assert out['sentry.interfaces.User']['ip_address'] == '127.0.0.1'
