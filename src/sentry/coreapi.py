"""
sentry.coreapi
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which aren't useful).
from __future__ import absolute_import, print_function

import base64
import logging
import six
import uuid
import zlib

from datetime import datetime, timedelta
from django.utils.crypto import constant_time_compare
from django.utils.encoding import smart_str
from gzip import GzipFile
from time import time

from sentry.app import env
from sentry.cache import default_cache
from sentry.constants import (
    CLIENT_RESERVED_ATTRS, DEFAULT_LOG_LEVEL, LOG_LEVELS, MAX_TAG_VALUE_LENGTH,
    MAX_TAG_KEY_LENGTH, VALID_PLATFORMS
)
from sentry.interfaces.base import get_interface, InterfaceValidationError
from sentry.interfaces.csp import Csp
from sentry.models import EventError, Project, ProjectKey, TagKey
from sentry.tasks.store import preprocess_event
from sentry.utils import json
from sentry.utils.auth import parse_auth_header
from sentry.utils.compat import StringIO
from sentry.utils.strings import decompress
from sentry.utils.validators import is_float

LOG_LEVEL_REVERSE_MAP = dict((v, k) for k, v in LOG_LEVELS.iteritems())


class APIError(Exception):
    http_status = 400
    msg = 'Invalid request'
    name = None

    def __init__(self, msg=None, name=None):
        if msg:
            self.msg = msg
        if self.name:
            self.name = name

    def __str__(self):
        return self.msg or ''


class APIUnauthorized(APIError):
    http_status = 401
    msg = 'Unauthorized'


class APIForbidden(APIError):
    http_status = 403


class APIRateLimited(APIError):
    http_status = 429
    msg = 'Creation of this event was denied due to rate limiting'
    name = 'rate_limit'

    def __init__(self, retry_after=None):
        self.retry_after = retry_after


class InvalidTimestamp(Exception):
    pass


class InvalidFingerprint(Exception):
    pass


class Auth(object):
    def __init__(self, auth_vars, is_public=False):
        self.client = auth_vars.get('sentry_client')
        self.version = str(auth_vars.get('sentry_version'))
        self.secret_key = auth_vars.get('sentry_secret')
        self.public_key = auth_vars.get('sentry_key')
        self.is_public = is_public


class ClientContext(object):
    def __init__(self, agent=None, version=None, project_id=None,
                 ip_address=None):
        # user-agent (i.e. raven-python)
        self.agent = agent
        # protocol version
        self.version = version
        # project instance
        self.project_id = project_id
        self.project = None
        self.ip_address = ip_address

    def bind_project(self, project):
        self.project = project
        self.project_id = project.id

    def bind_auth(self, auth):
        self.agent = auth.client
        self.version = auth.version

    def get_tags_context(self):
        return {
            'project': self.project_id,
            'agent': self.agent,
            'protocol': self.version
        }


class ClientLogHelper(object):
    def __init__(self, context):
        self.context = context
        self.logger = logging.getLogger('sentry.api')

    def debug(self, *a, **k):
        self.logger.debug(*a, **self._metadata(**k))

    def info(self, *a, **k):
        self.logger.info(*a, **self._metadata(**k))

    def warning(self, *a, **k):
        self.logger.warning(*a, **self._metadata(**k))

    def error(self, *a, **k):
        self.logger.error(*a, **self._metadata(**k))

    def _metadata(self, tags=None, extra=None, **kwargs):
        if not extra:
            extra = {}
        if not tags:
            tags = {}

        context = self.context

        project = context.project
        if project:
            project_label = '%s/%s' % (project.organization.slug, project.slug)
        else:
            project_label = 'id=%s' % (context.project_id,)

        tags.update(context.get_tags_context())
        tags['project'] = project_label

        extra['request'] = env.request
        extra['tags'] = tags
        extra['agent'] = context.agent
        extra['protocol'] = context.version
        extra['project'] = project_label

        kwargs['extra'] = extra

        return kwargs


class ClientApiHelper(object):
    def __init__(self, agent=None, version=None, project_id=None,
                 ip_address=None):
        self.context = ClientContext(
            agent=agent, version=version, project_id=project_id,
            ip_address=ip_address,
        )
        self.log = ClientLogHelper(self.context)

    def auth_from_request(self, request):
        if request.META.get('HTTP_X_SENTRY_AUTH', '')[:7].lower() == 'sentry ':
            result = parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
        elif request.META.get('HTTP_AUTHORIZATION', '')[:7].lower() == 'sentry ':
            result = parse_auth_header(request.META['HTTP_AUTHORIZATION'])
        else:
            result = {
                k: request.GET[k]
                for k in request.GET.iterkeys()
                if k[:7] == 'sentry_'
            }
        if not result:
            raise APIUnauthorized('Unable to find authentication information')

        origin = self.origin_from_request(request)
        auth = Auth(result, is_public=bool(origin))
        # default client to user agent
        if not auth.client:
            auth.client = request.META.get('HTTP_USER_AGENT')
        return auth

    def origin_from_request(self, request):
        """
        Returns either the Origin or Referer value from the request headers.
        """
        return request.META.get('HTTP_ORIGIN', request.META.get('HTTP_REFERER'))

    def project_from_auth(self, auth):
        if not auth.public_key:
            raise APIUnauthorized('Invalid api key')

        try:
            pk = ProjectKey.objects.get_from_cache(public_key=auth.public_key)
        except ProjectKey.DoesNotExist:
            raise APIUnauthorized('Invalid api key')

        # a secret key may not be present which will be validated elsewhere
        if not constant_time_compare(pk.secret_key, auth.secret_key or pk.secret_key):
            raise APIUnauthorized('Invalid api key')

        if not pk.is_active:
            raise APIUnauthorized('API key is disabled')

        if not pk.roles.store:
            raise APIUnauthorized('Key does not allow event storage access')

        return Project.objects.get_from_cache(id=pk.project_id)

    def decompress_deflate(self, encoded_data):
        try:
            return zlib.decompress(encoded_data)
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.info(unicode(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' % (
                type(e).__name__, e
            ))

    def decompress_gzip(self, encoded_data):
        try:
            fp = StringIO(encoded_data)
            try:
                f = GzipFile(fileobj=fp)
                return f.read()
            finally:
                f.close()
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.info(unicode(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                (type(e).__name__, e)
            )

    def decode_and_decompress_data(self, encoded_data):
        try:
            try:
                return decompress(encoded_data)
            except zlib.error:
                return base64.b64decode(encoded_data)
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.info(unicode(e), exc_info=True)
            raise APIError('Bad data decoding request (%s, %s)' %
                (type(e).__name__, e)
            )

    def safely_load_json_string(self, json_string):
        try:
            obj = json.loads(json_string)
            assert isinstance(obj, dict)
        except Exception as e:
            # This error should be caught as it suggests that there's a
            # bug somewhere in the client's code.
            self.log.info(unicode(e), exc_info=True)
            raise APIError('Bad data reconstructing object (%s, %s)' %
                (type(e).__name__, e)
            )

        # XXX: ensure keys are coerced to strings
        return dict((smart_str(k), v) for k, v in obj.iteritems())

    def _process_data_timestamp(self, data, current_datetime=None):
        value = data['timestamp']
        if not value:
            del data['timestamp']
            return data
        elif is_float(value):
            try:
                value = datetime.fromtimestamp(float(value))
            except Exception:
                raise InvalidTimestamp('Invalid value for timestamp: %r' % data['timestamp'])
        elif not isinstance(value, datetime):
            # all timestamps are in UTC, but the marker is optional
            if value.endswith('Z'):
                value = value[:-1]
            if '.' in value:
                # Python doesn't support long microsecond values
                # https://github.com/getsentry/sentry/issues/1610
                ts_bits = value.split('.', 1)
                value = '%s.%s' % (ts_bits[0], ts_bits[1][:2])
                fmt = '%Y-%m-%dT%H:%M:%S.%f'
            else:
                fmt = '%Y-%m-%dT%H:%M:%S'
            try:
                value = datetime.strptime(value, fmt)
            except Exception:
                raise InvalidTimestamp('Invalid value for timestamp: %r' % data['timestamp'])

        if current_datetime is None:
            current_datetime = datetime.now()

        if value > current_datetime + timedelta(minutes=1):
            raise InvalidTimestamp('Invalid value for timestamp (in future): %r' % value)

        if value < current_datetime - timedelta(days=30):
            raise InvalidTimestamp('Invalid value for timestamp (too old): %r' % value)

        data['timestamp'] = float(value.strftime('%s'))

        return data

    def _process_fingerprint(self, data):
        if not isinstance(data['fingerprint'], (list, tuple)):
            raise InvalidFingerprint

        result = []
        for bit in data['fingerprint']:
            if not isinstance(bit, (basestring, int, float)):
                raise InvalidFingerprint
            result.append(unicode(bit))
        return result

    def parse_client_as_sdk(self, value):
        if not value:
            return
        try:
            name, version = value.split('/', 1)
        except ValueError:
            try:
                name, version = value.split(' ', 1)
            except ValueError:
                return
        return {
            'name': name,
            'version': version,
        }

    def validate_data(self, project, data):
        # TODO(dcramer): move project out of the data packet
        data['project'] = project.id

        data['errors'] = []

        # Ignore any breadcrumbs data sent in older versions
        # of sentry server to be more backwards compatible without
        # yelling on every recorded event
        data.pop('breadcrumbs', None)
        data.pop('sentry.interfaces.Breadcrumbs', None)

        if not data.get('message'):
            data['message'] = '<no message value>'
        elif not isinstance(data['message'], six.string_types):
            raise APIForbidden('Invalid value for message')

        if data.get('culprit'):
            if not isinstance(data['culprit'], six.string_types):
                raise APIForbidden('Invalid value for culprit')

        if not data.get('event_id'):
            data['event_id'] = uuid.uuid4().hex
        elif not isinstance(data['event_id'], six.string_types):
            raise APIForbidden('Invalid value for event_id')

        if len(data['event_id']) > 32:
            self.log.info(
                'Discarded value for event_id due to length (%d chars)',
                len(data['event_id']))
            data['errors'].append({
                'type': EventError.VALUE_TOO_LONG,
                'name': 'event_id',
                'value': data['event_id'],
            })
            data['event_id'] = uuid.uuid4().hex

        if 'timestamp' in data:
            try:
                self._process_data_timestamp(data)
            except InvalidTimestamp as e:
                self.log.info(
                    'Discarded invalid value for timestamp: %r',
                    data['timestamp'], exc_info=True)
                data['errors'].append({
                    'type': EventError.INVALID_DATA,
                    'name': 'timestamp',
                    'value': data['timestamp'],
                })
                del data['timestamp']

        if 'fingerprint' in data:
            try:
                self._process_fingerprint(data)
            except InvalidFingerprint as e:
                self.log.info(
                    'Discarded invalid value for fingerprint: %r',
                    data['fingerprint'], exc_info=True)
                data['errors'].append({
                    'type': EventError.INVALID_DATA,
                    'name': 'fingerprint',
                    'value': data['fingerprint'],
                })
                del data['fingerprint']

        if 'platform' not in data or data['platform'] not in VALID_PLATFORMS:
            data['platform'] = 'other'

        if data.get('modules') and type(data['modules']) != dict:
            self.log.info(
                'Discarded invalid type for modules: %s',
                type(data['modules']))
            data['errors'].append({
                'type': EventError.INVALID_DATA,
                'name': 'modules',
                'value': data['modules'],
            })
            del data['modules']

        if data.get('extra') is not None and type(data['extra']) != dict:
            self.log.info(
                'Discarded invalid type for extra: %s',
                type(data['extra']))
            data['errors'].append({
                'type': EventError.INVALID_DATA,
                'name': 'extra',
                'value': data['extra'],
            })
            del data['extra']

        if data.get('tags') is not None:
            if type(data['tags']) == dict:
                data['tags'] = data['tags'].items()
            elif not isinstance(data['tags'], (list, tuple)):
                self.log.info(
                    'Discarded invalid type for tags: %s', type(data['tags']))
                data['errors'].append({
                    'type': EventError.INVALID_DATA,
                    'name': 'tags',
                    'value': data['tags'],
                })
                del data['tags']

        if data.get('tags'):
            # remove any values which are over 32 characters
            tags = []
            for pair in data['tags']:
                try:
                    k, v = pair
                except ValueError:
                    self.log.info('Discarded invalid tag value: %r', pair)
                    data['errors'].append({
                        'type': EventError.INVALID_DATA,
                        'name': 'tags',
                        'value': pair,
                    })
                    continue

                if not isinstance(k, six.string_types):
                    try:
                        k = six.text_type(k)
                    except Exception:
                        self.log.info('Discarded invalid tag key: %r', type(k))
                        data['errors'].append({
                            'type': EventError.INVALID_DATA,
                            'name': 'tags',
                            'value': pair,
                        })
                        continue

                if not isinstance(v, six.string_types):
                    try:
                        v = six.text_type(v)
                    except Exception:
                        self.log.info('Discarded invalid tag value: %s=%r',
                                      k, type(v))
                        data['errors'].append({
                            'type': EventError.INVALID_DATA,
                            'name': 'tags',
                            'value': pair,
                        })
                        continue

                if len(k) > MAX_TAG_KEY_LENGTH or len(v) > MAX_TAG_VALUE_LENGTH:
                    self.log.info('Discarded invalid tag: %s=%s', k, v)
                    data['errors'].append({
                        'type': EventError.INVALID_DATA,
                        'name': 'tags',
                        'value': pair,
                    })
                    continue

                # support tags with spaces by converting them
                k = k.replace(' ', '-')

                if TagKey.is_reserved_key(k):
                    self.log.info('Discarding reserved tag key: %s', k)
                    data['errors'].append({
                        'type': EventError.INVALID_DATA,
                        'name': 'tags',
                        'value': pair,
                    })
                    continue

                if not TagKey.is_valid_key(k):
                    self.log.info('Discarded invalid tag key: %s', k)
                    data['errors'].append({
                        'type': EventError.INVALID_DATA,
                        'name': 'tags',
                        'value': pair,
                    })
                    continue

                tags.append((k, v))
            data['tags'] = tags

        for k in data.keys():
            if k in CLIENT_RESERVED_ATTRS:
                continue

            value = data.pop(k)

            if not value:
                self.log.info('Ignored empty interface value: %s', k)
                continue

            try:
                interface = get_interface(k)
            except ValueError:
                self.log.info('Ignored unknown attribute: %s', k)
                data['errors'].append({
                    'type': EventError.INVALID_ATTRIBUTE,
                    'name': k,
                })
                continue

            if type(value) != dict:
                # HACK(dcramer): the exception/breadcrumbs interface supports a
                # list as the value. We should change this in a new protocol
                # version.
                if type(value) in (list, tuple):
                    value = {'values': value}
                else:
                    self.log.info(
                        'Invalid parameter for value: %s (%r)', k, type(value))
                    data['errors'].append({
                        'type': EventError.INVALID_DATA,
                        'name': k,
                        'value': value,
                    })
                    continue

            try:
                inst = interface.to_python(value)
                data[inst.get_path()] = inst.to_json()
            except Exception as e:
                if isinstance(e, InterfaceValidationError):
                    log = self.log.info
                else:
                    log = self.log.error
                log('Discarded invalid value for interface: %s (%r)', k, value,
                    exc_info=True)
                data['errors'].append({
                    'type': EventError.INVALID_DATA,
                    'name': k,
                    'value': value,
                })

        level = data.get('level') or DEFAULT_LOG_LEVEL
        if isinstance(level, six.string_types) and not level.isdigit():
            # assume it's something like 'warning'
            try:
                data['level'] = LOG_LEVEL_REVERSE_MAP[level]
            except KeyError as e:
                self.log.info(
                    'Discarded invalid logger value: %s', level)
                data['errors'].append({
                    'type': EventError.INVALID_DATA,
                    'name': 'level',
                    'value': level,
                })
                data['level'] = LOG_LEVEL_REVERSE_MAP.get(
                    DEFAULT_LOG_LEVEL, DEFAULT_LOG_LEVEL)

        if data.get('release'):
            data['release'] = unicode(data['release'])
            if len(data['release']) > 64:
                data['errors'].append({
                    'type': EventError.VALUE_TOO_LONG,
                    'name': 'release',
                    'value': data['release'],
                })
                del data['release']

        return data

    def ensure_does_not_have_ip(self, data):
        if 'sentry.interfaces.Http' in data:
            if 'env' in data['sentry.interfaces.Http']:
                data['sentry.interfaces.Http']['env'].pop('REMOTE_ADDR', None)

        if 'sentry.interfaces.User' in data:
            data['sentry.interfaces.User'].pop('ip_address', None)

    def ensure_has_ip(self, data, ip_address):
        if data.get('sentry.interfaces.Http', {}).get('env', {}).get('REMOTE_ADDR'):
            return

        if data.get('sentry.interfaces.User', {}).get('ip_address'):
            return

        data.setdefault('sentry.interfaces.User', {})['ip_address'] = ip_address

    def insert_data_to_database(self, data):
        cache_key = 'e:{1}:{0}'.format(data['project'], data['event_id'])
        default_cache.set(cache_key, data, timeout=3600)
        preprocess_event.delay(cache_key=cache_key, start_time=time())


class CspApiHelper(ClientApiHelper):
    def origin_from_request(self, request):
        # We don't use an origin here
        return None

    def auth_from_request(self, request):
        key = request.GET.get('sentry_key')
        if not key:
            raise APIUnauthorized('Unable to find authentication information')

        auth = Auth({
            'sentry_key': key,
        }, is_public=True)
        auth.client = request.META.get('HTTP_USER_AGENT')
        return auth

    def validate_data(self, project, data):
        # All keys are sent with hyphens, so we want to conver to underscores
        report = dict(map(lambda v: (v[0].replace('-', '_'), v[1]), data.iteritems()))

        try:
            inst = Csp.to_python(report)
        except Exception as exc:
            raise APIForbidden('Invalid CSP Report: %s' % exc)

        # Construct a faux Http interface based on the little information we have
        headers = {}
        if self.context.agent:
            headers['User-Agent'] = self.context.agent
        if inst.referrer:
            headers['Referer'] = inst.referrer

        return {
            'logger': 'csp',
            'project': project.id,
            'message': inst.get_message(),
            'culprit': inst.get_culprit(),
            'tags': inst.get_tags(),
            inst.get_path(): inst.to_json(),
            # This is a bit weird, since we don't have nearly enough
            # information to create an Http interface, but
            # this automatically will pick up tags for the User-Agent
            # which is actually important here for CSP
            'sentry.interfaces.Http': {
                'url': inst.document_uri,
                'headers': headers,
            },
            'sentry.interfaces.User': {
                'ip_address': self.context.ip_address,
            }
        }
