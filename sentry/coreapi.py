"""
sentry.coreapi
~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which arent useful).

from datetime import datetime
import base64
import logging
import time
import zlib

from django.utils.encoding import smart_str

from sentry.conf import settings
from sentry.exceptions import InvalidData, InvalidInterface
from sentry.models import Group, ProjectMember
from sentry.queue.client import delay
from sentry.utils import is_float, json
from sentry.utils.auth import get_signature, parse_auth_header

logger = logging.getLogger('sentry.errors.coreapi')


class InvalidTimestamp(ValueError):
    pass


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


def project_from_auth_vars(auth_vars, data):
    signature = auth_vars.get('sentry_signature')
    timestamp = auth_vars.get('sentry_timestamp')
    api_key = auth_vars.get('sentry_key')
    if not signature or not timestamp:
        raise APIUnauthorized()

    if api_key:
        try:
            pm = ProjectMember.objects.get(public_key=api_key)
        except ProjectMember.DoesNotExist:
            raise APIForbidden('Invalid signature')
        project = pm.project
        secret_key = pm.secret_key
    else:
        project = None
        secret_key = settings.KEY

    validate_hmac(data, signature, timestamp, secret_key)

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
        pm = ProjectMember.objects.get(public_key=api_key, project=project_id)
    except ProjectMember.DoesNotExist:
        raise APIUnauthorized()

    return pm.project


def project_from_id(request):
    """
    Given a request returns a project instance or throws
    APIUnauthorized.
    """
    try:
        pm = ProjectMember.objects.get(
            user=request.user,
            project=request.GET['project_id'],
        )
    except ProjectMember.DoesNotExist:
        raise APIUnauthorized()

    return pm.project


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
    if desired_project and str(data.get('project', '')) != str(desired_project.pk):
        raise APIForbidden('Invalid credentials')
    elif not desired_project:
        data['project'] = 1


def process_data_timestamp(data):
    if is_float(data['timestamp']):
        try:
            data['timestamp'] = datetime.fromtimestamp(float(data['timestamp']))
        except:
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
        except:
            raise InvalidTimestamp('Invalid value for timestamp: %r' % data['timestamp'])

    return data


def validate_data(project, data):
    ensure_valid_project_id(project, data)

    if 'timestamp' in data:
        process_data_timestamp(data)

    return data


def insert_data_to_database(data, queue=None):
    if queue is None:
        queue = settings.USE_QUEUE

    if queue:
        delay(insert_data_to_database, data, queue=False)
    else:
        try:
            Group.objects.from_kwargs(**data)
        except (InvalidInterface, InvalidData), e:
            raise APIError(e)
