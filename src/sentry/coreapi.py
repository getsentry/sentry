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

from django.contrib.auth.models import User
from django.utils.encoding import smart_str

from sentry.app import env
from sentry.conf import settings
from sentry.exceptions import InvalidTimestamp
from sentry.models import Project, ProjectKey, TeamMember, Team
from sentry.plugins import plugins
from sentry.tasks.store import store_event
from sentry.utils import is_float, json
from sentry.utils.auth import parse_auth_header
from sentry.utils.imports import import_string
from sentry.utils.queue import maybe_delay
from sentry.utils.strings import decompress


logger = logging.getLogger('sentry.coreapi.errors')

MAX_CULPRIT_LENGTH = 200
MAX_MESSAGE_LENGTH = 5000

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


def client_metadata(client=None, exception=None, tags=None, extra=None):
    if not extra:
        extra = {}
    if not tags:
        tags = {}

    extra['client'] = client
    extra['request'] = env.request
    extra['tags'] = tags

    tags['client'] = client
    if exception:
        tags['exc_type'] = type(exception).__name__

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
        return request.GET


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

    if pk.user:
        try:
            team = Team.objects.get_from_cache(pk=project.team_id)
        except Team.DoesNotExist:
            raise APIUnauthorized('Member does not have access to project')

        try:
            TeamMember.objects.get(team=team, user=pk.user, is_active=True)
        except TeamMember.DoesNotExist:
            raise APIUnauthorized('Member does not have access to project')

        # We have to refetch this as it may have been caught
        pk.user = User.objects.get(id=pk.user_id)
        if not pk.user.is_active:
            raise APIUnauthorized('Account is not active')

    return project, pk.user


def project_from_api_key_and_id(api_key, project_id):
    """
    Given a public api key and a project id returns
    a project instance or throws APIUnauthorized.
    """
    try:
        pk = ProjectKey.objects.get_from_cache(public_key=api_key)
    except ProjectKey.DoesNotExist:
        raise APIUnauthorized('Invalid api key')

    if str(project_id).isdigit():
        if str(pk.project_id) != str(project_id):
            raise APIUnauthorized('Invalid project id')
    else:
        if str(pk.project.slug) != str(project_id):
            raise APIUnauthorized('Invalid project id')

    project = Project.objects.get_from_cache(pk=pk.project_id)

    if pk.user:
        team = Team.objects.get_from_cache(pk=project.team_id)

        try:
            tm = TeamMember.objects.get(team=team, user=pk.user, is_active=True)
        except TeamMember.DoesNotExist:
            raise APIUnauthorized('Member does not have access to project')

        # We have to refetch this as it may have been caught
        pk.user = User.objects.get(id=pk.user_id)
        if not pk.user.is_active:
            raise APIUnauthorized('Account is not active')

        tm.project = project

        result = plugins.first('has_perm', tm.user, 'create_event', project)
        if result is False:
            raise APIForbidden('Creation of this event was blocked')

    return project


def project_from_id(request):
    """
    Given a request returns a project instance or throws
    APIUnauthorized.
    """
    if not request.user.is_active:
        raise APIUnauthorized('Account is not active')

    try:
        project = Project.objects.get_from_cache(pk=request.GET['project_id'])
    except Project.DoesNotExist:
        raise APIUnauthorized('Invalid project')

    try:
        team = Team.objects.get_from_cache(pk=project.team_id)
    except Project.DoesNotExist:
        raise APIUnauthorized('Member does not have access to project')

    try:
        TeamMember.objects.get(
            user=request.user,
            team=team,
            is_active=True,
        )
    except TeamMember.DoesNotExist:
        raise APIUnauthorized('Member does not have access to project')

    result = plugins.first('has_perm', request.user, 'create_event', project)
    if result is False:
        raise APIForbidden('Creation of this event was blocked')

    return project


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
            logger.info('Project ID mismatch: %s != %s', desired_project.id, desired_project.slug,
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
        logger.error('Truncated value for message due to length (%d chars)', len(data['message']),
            **client_metadata(client))
        data['message'] = data['message'][:MAX_MESSAGE_LENGTH]

    if data.get('culprit') and len(data['culprit']) > MAX_CULPRIT_LENGTH:
        logger.error('Truncated value for culprit due to length (%d chars)', len(data['culprit']),
            **client_metadata(client))
        data['culprit'] = data['culprit'][:MAX_CULPRIT_LENGTH]

    if not data.get('event_id'):
        data['event_id'] = uuid.uuid4().hex
    if len(data['event_id']) > 32:
        logger.error('Discarded value for event_id due to length (%d chars)', len(data['event_id']),
            **client_metadata(client))
        data['event_id'] = uuid.uuid4().hex

    if 'timestamp' in data:
        try:
            process_data_timestamp(data)
        except InvalidTimestamp, e:
            # Log the error, remove the timestamp, and continue
            logger.info('Discarded invalid value for timestamp: %r', data['timestamp'],
                **client_metadata(client, exception=e))
            del data['timestamp']

    if data.get('modules') and type(data['modules']) != dict:
        logger.error('Discarded invalid type for modules: %s', type(data['modules']),
            **client_metadata(client))
        del data['modules']

    if data.get('extra') and type(data['extra']) != dict:
        logger.error('Discarded invalid type for extra: %s', type(data['extra']),
            **client_metadata(client))
        del data['extra']

    for k in data.keys():
        if k in RESERVED_FIELDS:
            continue

        if not data[k]:
            logger.info('Ignored empty interface value: %s', k, **client_metadata(client))
            del data[k]
            continue

        import_path = INTERFACE_ALIASES.get(k, k)

        if '.' not in import_path:
            logger.warning('Ignored unknown attribute: %s', k, **client_metadata(client))
            del data[k]
            continue

        try:
            interface = import_string(import_path)
        except (ImportError, AttributeError), e:
            logger.warning('Invalid unknown attribute: %s', k, **client_metadata(client, exception=e))
            del data[k]
            continue

        value = data.pop(k)
        try:
            inst = interface(**value)
            inst.validate()
            data[import_path] = inst.serialize()
        except Exception, e:
            if isinstance(e, AssertionError):
                log = logger.warning
            else:
                log = logger.error
            log('Discarded invalid value for interface: %s', k,
                **client_metadata(client, exception=e, extra={'value': value}))

    level = data.get('level') or settings.DEFAULT_LOG_LEVEL
    if isinstance(level, basestring) and not level.isdigit():
        # assume it's something like 'warning'
        try:
            data['level'] = settings.LOG_LEVEL_REVERSE_MAP[level]
        except KeyError, e:
            logger.warning('Discarded invalid logger value: %s', level, **client_metadata(client, exception=e))
            data['level'] = settings.LOG_LEVEL_REVERSE_MAP.get(settings.DEFAULT_LOG_LEVEL,
                settings.DEFAULT_LOG_LEVEL)

    return data


def insert_data_to_database(data):
    maybe_delay(store_event, data=data)
