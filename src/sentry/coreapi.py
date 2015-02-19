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

from sentry.app import cache, env
from sentry.constants import (
    DEFAULT_LOG_LEVEL, LOG_LEVELS, MAX_TAG_VALUE_LENGTH,
    MAX_TAG_KEY_LENGTH)
from sentry.exceptions import InvalidTimestamp
from sentry.interfaces.base import get_interface
from sentry.models import Project, ProjectKey
from sentry.tasks.store import preprocess_event
from sentry.utils import is_float, json
from sentry.utils.auth import parse_auth_header
from sentry.utils.compat import StringIO
from sentry.utils.strings import decompress


logger = logging.getLogger('sentry.coreapi')

LOG_LEVEL_REVERSE_MAP = dict((v, k) for k, v in LOG_LEVELS.iteritems())

RESERVED_FIELDS = (
    'project',
    'event_id',
    'message',
    'checksum',
    'culprit',
    'level',
    'time_spent',
    'logger',
    'server_name',
    'site',
    'timestamp',
    'extra',
    'modules',
    'tags',
    'platform',
    'release',
)


class APIError(Exception):
    http_status = 400
    msg = 'Invalid request'

    def __init__(self, msg=None):
        if msg:
            self.msg = msg

    def __str__(self):
        return self.msg or ''


class APIUnauthorized(APIError):
    http_status = 401
    msg = 'Unauthorized'


class APIForbidden(APIError):
    http_status = 403


class APITimestampExpired(APIError):
    http_status = 410


class APIRateLimited(APIError):
    http_status = 429
    msg = 'Creation of this event was denied due to rate limiting.'

    def __init__(self, retry_after=None):
        self.retry_after = retry_after


def client_metadata(client=None, project=None, exception=None, tags=None, extra=None):
    if not extra:
        extra = {}
    if not tags:
        tags = {}

    extra['client'] = client
    extra['request'] = env.request
    extra['tags'] = tags
    if project:
        extra['project_slug'] = project.slug
        extra['project_id'] = project.id
        if project.team:
            extra['team_slug'] = project.team.slug
            extra['team_id'] = project.team.id
        if project.organization:
            extra['organization_slug'] = project.organization.slug
            extra['organization_id'] = project.organization.id

    tags['client'] = client
    if exception:
        tags['exc_type'] = type(exception).__name__
    if project and project.organization:
        tags['project'] = '%s/%s' % (project.organization.slug, project.slug)

    result = {'extra': extra}
    if exception:
        result['exc_info'] = True
    return result


def extract_auth_vars(request):
    if request.META.get('HTTP_X_SENTRY_AUTH', '').startswith('Sentry'):
        return parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
    elif request.META.get('HTTP_AUTHORIZATION', '').startswith('Sentry'):
        return parse_auth_header(request.META['HTTP_AUTHORIZATION'])
    else:
        return dict(
            (k, request.GET[k])
            for k in request.GET.iterkeys()
            if k.startswith('sentry_')
        )


def project_from_auth_vars(auth_vars):
    api_key = auth_vars.get('sentry_key')
    if not api_key:
        raise APIForbidden('Invalid api key')
    try:
        pk = ProjectKey.objects.get_from_cache(public_key=api_key)
    except ProjectKey.DoesNotExist:
        raise APIForbidden('Invalid api key')

    if not constant_time_compare(pk.secret_key, auth_vars.get('sentry_secret', pk.secret_key)):
        raise APIForbidden('Invalid api key')

    if not pk.is_active:
        raise APIForbidden('API key is disabled')

    if not pk.roles.store:
        raise APIForbidden('Key does not allow event storage access')

    project = Project.objects.get_from_cache(pk=pk.project_id)

    return project, pk.user


def decompress_deflate(encoded_data):
    try:
        return zlib.decompress(encoded_data)
    except Exception as e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data decoding request (%s, %s)' % (
            e.__class__.__name__, e))


def decompress_gzip(encoded_data):
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
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data decoding request (%s, %s)' % (
            e.__class__.__name__, e))


def decode_and_decompress_data(encoded_data):
    try:
        try:
            return decompress(encoded_data)
        except zlib.error:
            return base64.b64decode(encoded_data)
    except Exception as e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data decoding request (%s, %s)' % (
            e.__class__.__name__, e))


def safely_load_json_string(json_string):
    try:
        obj = json.loads(json_string)
    except Exception as e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data reconstructing object (%s, %s)' % (
            e.__class__.__name__, e))

    # XXX: ensure keys are coerced to strings
    return dict((smart_str(k), v) for k, v in obj.iteritems())


def process_data_timestamp(data, current_datetime=None):
    if not data['timestamp']:
        del data['timestamp']
        return data
    elif is_float(data['timestamp']):
        try:
            data['timestamp'] = datetime.fromtimestamp(float(data['timestamp']))
        except Exception:
            raise InvalidTimestamp('Invalid value for timestamp: %r' % data['timestamp'])
    elif not isinstance(data['timestamp'], datetime):
        if '.' in data['timestamp']:
            format = '%Y-%m-%dT%H:%M:%S.%f'
        else:
            format = '%Y-%m-%dT%H:%M:%S'
        if 'Z' in data['timestamp']:
            # support UTC market, but not other timestamps
            format += 'Z'
        try:
            data['timestamp'] = datetime.strptime(data['timestamp'], format)
        except Exception:
            raise InvalidTimestamp('Invalid value for timestamp: %r' % data['timestamp'])

    if current_datetime is None:
        current_datetime = datetime.now()

    if data['timestamp'] > current_datetime + timedelta(minutes=1):
        raise InvalidTimestamp('Invalid value for timestamp (in future): %r' % data['timestamp'])

    if data['timestamp'] < current_datetime - timedelta(days=30):
        raise InvalidTimestamp('Invalid value for timestamp (too old): %r' % data['timestamp'])

    data['timestamp'] = float(data['timestamp'].strftime('%s'))

    return data


def validate_data(project, data, client=None):
    # TODO(dcramer): move project out of the data packet
    data['project'] = project.id

    if not data.get('message'):
        data['message'] = '<no message value>'
    elif not isinstance(data['message'], six.string_types):
        raise APIError('Invalid value for message')

    if data.get('culprit'):
        if not isinstance(data['culprit'], six.string_types):
            raise APIError('Invalid value for culprit')

    if not data.get('event_id'):
        data['event_id'] = uuid.uuid4().hex
    elif not isinstance(data['event_id'], six.string_types):
        raise APIError('Invalid value for event_id')
    if len(data['event_id']) > 32:
        logger.info(
            'Discarded value for event_id due to length (%d chars)',
            len(data['event_id']), **client_metadata(client, project))
        data['event_id'] = uuid.uuid4().hex

    if 'timestamp' in data:
        try:
            process_data_timestamp(data)
        except InvalidTimestamp as e:
            # Log the error, remove the timestamp, and continue
            logger.info(
                'Discarded invalid value for timestamp: %r', data['timestamp'],
                **client_metadata(client, project, exception=e))
            del data['timestamp']

    if data.get('modules') and type(data['modules']) != dict:
        logger.info(
            'Discarded invalid type for modules: %s',
            type(data['modules']), **client_metadata(client, project))
        del data['modules']

    if data.get('extra') is not None and type(data['extra']) != dict:
        logger.info(
            'Discarded invalid type for extra: %s',
            type(data['extra']), **client_metadata(client, project))
        del data['extra']

    if data.get('tags') is not None:
        if type(data['tags']) == dict:
            data['tags'] = data['tags'].items()
        elif not isinstance(data['tags'], (list, tuple)):
            logger.info(
                'Discarded invalid type for tags: %s',
                type(data['tags']), **client_metadata(client, project))
            del data['tags']

    if data.get('tags'):
        # remove any values which are over 32 characters
        tags = []
        for pair in data['tags']:
            try:
                k, v = pair
            except ValueError:
                logger.info('Discarded invalid tag value: %r',
                            pair, **client_metadata(client, project))
                continue

            if not isinstance(k, six.string_types):
                try:
                    k = six.text_type(k)
                except Exception:
                    logger.info('Discarded invalid tag key: %r',
                                type(k), **client_metadata(client, project))
                    continue

            if not isinstance(v, six.string_types):
                try:
                    v = six.text_type(v)
                except Exception:
                    logger.info('Discarded invalid tag value: %s=%r',
                                k, type(v), **client_metadata(client, project))
                    continue
            if len(k) > MAX_TAG_KEY_LENGTH or len(v) > MAX_TAG_VALUE_LENGTH:
                logger.info('Discarded invalid tag: %s=%s',
                            k, v, **client_metadata(client, project))
                continue
            tags.append((k, v))
        data['tags'] = tags

    for k in data.keys():
        if k in RESERVED_FIELDS:
            continue

        value = data.pop(k)

        if not value:
            logger.info(
                'Ignored empty interface value: %s', k,
                **client_metadata(client, project))
            continue

        try:
            interface = get_interface(k)
        except ValueError:
            logger.info(
                'Ignored unknown attribute: %s', k,
                **client_metadata(client, project))
            continue

        if type(value) != dict:
            # HACK(dcramer): the exception interface supports a list as the
            # value. We should change this in a new protocol version.
            if type(value) in (list, tuple):
                value = {'values': value}
            else:
                logger.info(
                    'Invalid parameters for value: %s', k,
                    type(value), **client_metadata(client, project))
                continue

        try:
            inst = interface.to_python(value)
            data[inst.get_path()] = inst.to_json()
        except Exception as e:
            if isinstance(e, AssertionError):
                log = logger.info
            else:
                log = logger.error
            log('Discarded invalid value for interface: %s', k,
                **client_metadata(client, project, exception=e, extra={'value': value}))

    level = data.get('level') or DEFAULT_LOG_LEVEL
    if isinstance(level, six.string_types) and not level.isdigit():
        # assume it's something like 'warning'
        try:
            data['level'] = LOG_LEVEL_REVERSE_MAP[level]
        except KeyError as e:
            logger.info(
                'Discarded invalid logger value: %s', level,
                **client_metadata(client, project, exception=e))
            data['level'] = LOG_LEVEL_REVERSE_MAP.get(
                DEFAULT_LOG_LEVEL, DEFAULT_LOG_LEVEL)

    return data


def ensure_does_not_have_ip(data):
    if 'sentry.interfaces.Http' in data:
        if 'env' in data['sentry.interfaces.Http']:
            data['sentry.interfaces.Http']['env'].pop('REMOTE_ADDR', None)

    if 'sentry.interfaces.User' in data:
        data['sentry.interfaces.User'].pop('ip_address', None)


def ensure_has_ip(data, ip_address):
    if data.get('sentry.interfaces.Http', {}).get('env', {}).get('REMOTE_ADDR'):
        return

    if data.get('sentry.interfaces.User', {}).get('ip_address'):
        return

    data.setdefault('sentry.interfaces.User', {})['ip_address'] = ip_address


def insert_data_to_database(data):
    cache_key = 'e:{1}:{0}'.format(data['project'], data['event_id'])
    cache.set(cache_key, data, timeout=3600)
    preprocess_event.delay(cache_key=cache_key)
