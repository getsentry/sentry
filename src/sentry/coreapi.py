"""
sentry.coreapi
~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which arent useful).

from datetime import datetime
import base64
import logging
import time
import uuid
import zlib

from django.utils.encoding import smart_str

from sentry.conf import settings
from sentry.exceptions import InvalidInterface, InvalidData, InvalidTimestamp
from sentry.models import Project, ProjectKey, TeamMember, Team
from sentry.plugins import plugins
from sentry.tasks.store import store_event
from sentry.utils import is_float, json
from sentry.utils.auth import get_signature, parse_auth_header
from sentry.utils.imports import import_string
from sentry.utils.queue import maybe_delay

logger = logging.getLogger('sentry.errors.coreapi')

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
)


class APIError(Exception):
    http_status = 400
    msg = 'Invalid request'

    def __init__(self, msg=None):
        if msg:
            self.msg = msg


class APIUnauthorized(APIError):
    http_status = 401
    msg = 'Unauthorized'


class APIForbidden(APIError):
    http_status = 403


class APITimestampExpired(APIError):
    http_status = 410


def extract_auth_vars(request):
    if request.META.get('HTTP_X_SENTRY_AUTH', '').startswith('Sentry'):
        # Auth version 3.0 (same as 2.0, diff header)
        return parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
    elif request.META.get('HTTP_AUTHORIZATION', '').startswith('Sentry'):
        # Auth version 2.0
        return parse_auth_header(request.META['HTTP_AUTHORIZATION'])
    else:
        return None


def project_from_auth_vars(auth_vars, data, require_signature=False):
    api_key = auth_vars.get('sentry_key')
    if api_key:
        try:
            pk = ProjectKey.objects.get_from_cache(public_key=api_key)
        except ProjectKey.DoesNotExist:
            raise APIForbidden('Invalid signature')

        project = Project.objects.get_from_cache(pk=pk.project_id)
        secret_key = pk.secret_key

        if pk.user:
            try:
                team = Team.objects.get_from_cache(pk=project.team_id)
            except Team.DoesNotExist:
                raise APIUnauthorized('Member does not have access to project')

            try:
                tm = TeamMember.objects.get(team=team, user=pk.user, is_active=True)
            except TeamMember.DoesNotExist:
                raise APIUnauthorized('Member does not have access to project')

            if not pk.user.is_active:
                raise APIUnauthorized('Account is not active')

        result = plugins.first('has_perm', tm.user, 'create_event', project)
        if result is False:
            raise APIUnauthorized('This event cannot be recorded')
    else:
        project = None
        secret_key = settings.KEY

    signature = auth_vars.get('sentry_signature')
    timestamp = auth_vars.get('sentry_timestamp')
    if signature and timestamp:
        validate_hmac(data, signature, timestamp, secret_key)
    elif require_signature:
        raise APIUnauthorized('Missing signature')

    return project


def validate_hmac(message, signature, timestamp, secret_key):
    try:
        timestamp_float = float(timestamp)
    except ValueError:
        raise APIError('Invalid timestamp')

    if timestamp_float < time.time() - 3600:  # 1 hour
        raise APITimestampExpired('Message has expired')

    sig_hmac = get_signature(message, timestamp, secret_key)
    if sig_hmac != signature:
        raise APIForbidden('Invalid signature')


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

        if not pk.user.is_active:
            raise APIUnauthorized('Account is not active')

        tm.project = project

    result = plugins.first('has_perm', tm.user, 'create_event', project)
    if result is False:
        raise APIUnauthorized()

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
        raise APIUnauthorized()

    return project


def decode_and_decompress_data(encoded_data):
    try:
        try:
            return base64.b64decode(encoded_data).decode('zlib')
        except zlib.error:
            return base64.b64decode(encoded_data)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.exception('Bad data received')
        raise APIForbidden('Bad data decoding request (%s, %s)' % (
            e.__class__.__name__, e))


def safely_load_json_string(json_string):
    try:
        obj = json.loads(json_string)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.exception('Bad data received')
        raise APIForbidden('Bad data reconstructing object (%s, %s)' % (
            e.__class__.__name__, e))

    # XXX: ensure keys are coerced to strings
    return dict((smart_str(k), v) for k, v in obj.iteritems())


def ensure_valid_project_id(desired_project, data):
    # Confirm they're using either the master key, or their specified project
    # matches with the signed project.
    if desired_project:
        if str(data.get('project', '')) not in [str(desired_project.pk), desired_project.slug]:
            raise APIForbidden('Invalid credentials')
        data['project'] = desired_project.pk
    elif not desired_project:
        data['project'] = 1


def process_data_timestamp(data):
    if is_float(data['timestamp']):
        try:
            data['timestamp'] = datetime.fromtimestamp(float(data['timestamp']))
        except Exception:
            logger.exception('Failed reading timestamp')
            del data['timestamp']
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

    return data


def validate_data(project, data, client=None):
    ensure_valid_project_id(project, data)

    if not data.get('message'):
        data['message'] = '<no message value>'

    if 'event_id' not in data:
        data['event_id'] = uuid.uuid4().hex

    if 'timestamp' in data:
        try:
            process_data_timestamp(data)
        except InvalidTimestamp:
            # Log the error, remove the timestamp, and continue
            logger.error('Client %r passed an invalid value for timestamp %r',
                client or '<unknown client>',
                data['timestamp'],
            )
            del data['timestamp']

    if data.get('modules') and type(data['modules']) != dict:
        raise InvalidData('Invalid type for \'modules\': must be a mapping')

    for k, v in data.iteritems():
        if k in RESERVED_FIELDS:
            continue

        if '.' not in k:
            raise InvalidInterface('%r is not a valid interface name' % k)

        try:
            interface = import_string(k)
        except (ImportError, AttributeError), e:
            raise InvalidInterface('%r is not a valid interface name: %s' % (k, e))

        try:
            data[k] = interface(**v).serialize()
        except Exception, e:
            raise InvalidData('Unable to validate interface, %r: %s' % (k, e))

    level = data.get('level') or settings.DEFAULT_LOG_LEVEL
    if isinstance(level, basestring) and not level.isdigit():
        # assume it's something like 'warning'
        try:
            data['level'] = settings.LOG_LEVEL_REVERSE_MAP[level]
        except KeyError:
            raise InvalidData('Invalid logging level specified: %r' % level)

    return data


def insert_data_to_database(data):
    maybe_delay(store_event, data=data)
