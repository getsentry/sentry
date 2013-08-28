"""
sentry.coreapi
~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which aren't useful).

from datetime import datetime, timedelta
import base64
import logging
import uuid
import zlib

from django.conf import settings
from django.utils.encoding import smart_str

from sentry.app import env
from sentry.constants import (
    DEFAULT_LOG_LEVEL, LOG_LEVELS, MAX_MESSAGE_LENGTH, MAX_CULPRIT_LENGTH,
    MAX_TAG_VALUE_LENGTH, MAX_TAG_KEY_LENGTH)
from sentry.exceptions import InvalidTimestamp
from sentry.models import Project, ProjectKey
from sentry.tasks.store import preprocess_event
from sentry.utils import is_float, json
from sentry.utils.auth import parse_auth_header
from sentry.utils.imports import import_string
from sentry.utils.strings import decompress, truncatechars


logger = logging.getLogger('sentry.coreapi.errors')

LOG_LEVEL_REVERSE_MAP = dict((v, k) for k, v in LOG_LEVELS.iteritems())

INTERFACE_ALIASES = {
    'exception': 'sentry.interfaces.Exception',
    'request': 'sentry.interfaces.Http',
    'user': 'sentry.interfaces.User',
    'stacktrace': 'sentry.interfaces.Stacktrace',
    'template': 'sentry.interfaces.Template',
}

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


def get_interface(name):
    if name not in settings.SENTRY_ALLOWED_INTERFACES:
        raise ValueError

    try:
        interface = import_string(name)
    except Exception:
        raise ValueError('Unable to load interface: %s' % (name,))

    return interface


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

    tags['client'] = client
    if exception:
        tags['exc_type'] = type(exception).__name__
    if project and project.team:
        tags['project'] = '%s/%s' % (project.team.slug, project.slug)

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

    if pk.secret_key != auth_vars.get('sentry_secret', pk.secret_key):
        raise APIForbidden('Invalid api key')

    project = Project.objects.get_from_cache(pk=pk.project_id)

    return project, pk.user


def decode_and_decompress_data(encoded_data):
    try:
        try:
            return decompress(encoded_data)
        except zlib.error:
            return base64.b64decode(encoded_data)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data decoding request (%s, %s)' % (
            e.__class__.__name__, e))


def safely_load_json_string(json_string):
    try:
        obj = json.loads(json_string)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.info(e, **client_metadata(exception=e))
        raise APIForbidden('Bad data reconstructing object (%s, %s)' % (
            e.__class__.__name__, e))

    # XXX: ensure keys are coerced to strings
    return dict((smart_str(k), v) for k, v in obj.iteritems())


def ensure_valid_project_id(desired_project, data, client=None):
    # Confirm they're using either the master key, or their specified project
    # matches with the signed project.
    if desired_project and data.get('project'):
        if str(data.get('project')) not in [str(desired_project.id), desired_project.slug]:
            logger.info(
                'Project ID mismatch: %s != %s', desired_project.id, desired_project.slug,
                **client_metadata(client))
            raise APIForbidden('Invalid credentials')
        data['project'] = desired_project.id
    elif not desired_project:
        data['project'] = 1
    elif not data.get('project'):
        data['project'] = desired_project.id


def process_data_timestamp(data):
    if is_float(data['timestamp']):
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

    if data['timestamp'] > datetime.now() + timedelta(minutes=1):
        raise InvalidTimestamp('Invalid value for timestamp (in future): %r' % data['timestamp'])

    return data


def validate_data(project, data, client=None):
    ensure_valid_project_id(project, data, client=client)

    if not data.get('message'):
        data['message'] = '<no message value>'
    elif not isinstance(data['message'], basestring):
        raise APIError('Invalid value for message')
    elif len(data['message']) > MAX_MESSAGE_LENGTH:
        logger.info(
            'Truncated value for message due to length (%d chars)',
            len(data['message']), **client_metadata(client, project))
        data['message'] = truncatechars(data['message'], MAX_MESSAGE_LENGTH)

    if data.get('culprit') and len(data['culprit']) > MAX_CULPRIT_LENGTH:
        logger.info(
            'Truncated value for culprit due to length (%d chars)',
            len(data['culprit']), **client_metadata(client, project))
        data['culprit'] = truncatechars(data['culprit'], MAX_CULPRIT_LENGTH)

    if not data.get('event_id'):
        data['event_id'] = uuid.uuid4().hex
    if len(data['event_id']) > 32:
        logger.info(
            'Discarded value for event_id due to length (%d chars)',
            len(data['event_id']), **client_metadata(client, project))
        data['event_id'] = uuid.uuid4().hex

    if 'timestamp' in data:
        try:
            process_data_timestamp(data)
        except InvalidTimestamp, e:
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
        for k, v in data['tags']:
            if not isinstance(k, basestring):
                try:
                    k = unicode(k)
                except Exception:
                    logger.info('Discarded invalid tag key: %r',
                                type(k), **client_metadata(client, project))
                    continue
            if not isinstance(v, basestring):
                try:
                    v = unicode(v)
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

        if not data[k]:
            logger.info(
                'Ignored empty interface value: %s', k,
                **client_metadata(client, project))
            del data[k]
            continue

        import_path = INTERFACE_ALIASES.get(k, k)

        if '.' not in import_path:
            logger.info(
                'Ignored unknown attribute: %s', k,
                **client_metadata(client, project))
            del data[k]
            continue

        try:
            interface = get_interface(import_path)
        except ValueError:
            logger.info(
                'Invalid unknown attribute: %s', k,
                **client_metadata(client, project))
            del data[k]
            continue

        value = data.pop(k)
        try:
            # HACK: exception allows you to pass the value as a list
            # so let's try to actually support that
            if isinstance(value, dict):
                inst = interface(**value)
            else:
                inst = interface(value)
            inst.validate()
            data[import_path] = inst.serialize()
        except Exception, e:
            if isinstance(e, AssertionError):
                log = logger.info
            else:
                log = logger.error
            log('Discarded invalid value for interface: %s', k,
                **client_metadata(client, project, exception=e, extra={'value': value}))

    level = data.get('level') or DEFAULT_LOG_LEVEL
    if isinstance(level, basestring) and not level.isdigit():
        # assume it's something like 'warning'
        try:
            data['level'] = LOG_LEVEL_REVERSE_MAP[level]
        except KeyError, e:
            logger.info(
                'Discarded invalid logger value: %s', level,
                **client_metadata(client, project, exception=e))
            data['level'] = LOG_LEVEL_REVERSE_MAP.get(
                DEFAULT_LOG_LEVEL, DEFAULT_LOG_LEVEL)

    return data


def ensure_has_ip(data, ip_address):
    if data.get('sentry.interfaces.Http', {}).get('env', {}).get('REMOTE_ADDR'):
        return

    if data.get('sentry.interfaces.User', {}).get('ip_address'):
        return

    data.setdefault('sentry.interfaces.User', {})['ip_address'] = ip_address


def insert_data_to_database(data):
    preprocess_event.delay(data=data)
