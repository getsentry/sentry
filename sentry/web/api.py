"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import base64
import datetime
import logging
import time
import warnings
import zlib

from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseGone
from django.utils.encoding import smart_str
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.conf import settings
from sentry.models import GroupedMessage, ProjectMember
from sentry.utils import is_float, json
from sentry.utils.auth import get_signature, parse_auth_header
from sentry.utils.compat import pickle

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(['POST'])
def store(request):
    if request.META.get('HTTP_X_SENTRY_AUTH', '').startswith('Sentry'):
        # Auth version 2.0
        auth_vars = parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
    elif request.META.get('HTTP_AUTHORIZATION', '').startswith('Sentry'):
        # Auth version 2.0
        auth_vars = parse_auth_header(request.META['HTTP_AUTHORIZATION'])
    else:
        auth_vars = None

    if auth_vars:
        signature = auth_vars.get('sentry_signature')
        timestamp = auth_vars.get('sentry_timestamp')
        api_key = auth_vars.get('sentry_key')
        # version = auth_vars.get('sentry_version')

        if api_key:
            try:
                pm = ProjectMember.objects.get(api_key=api_key)
                if not pm.has_perm('add_message'):
                    raise ProjectMember.DoesNotExist
            except ProjectMember.DoesNotExist:
                return HttpResponseForbidden('Invalid signature')
            project = pm.project
            secret_key = pm.secret_key
        else:
            project = None
            secret_key = settings.KEY

        format = 'json'

        data = request.raw_post_data

        # Signed data packet
        if signature and timestamp:
            try:
                timestamp = float(timestamp)
            except ValueError:
                return HttpResponseBadRequest('Invalid timestamp')

            if timestamp < time.time() - 3600: # 1 hour
                return HttpResponseGone('Message has expired')

            sig_hmac = get_signature(data, timestamp, secret_key)
            if sig_hmac != signature:
                return HttpResponseForbidden('Invalid signature')
        else:
            return HttpResponse('Unauthorized', status_code=401)
    else:
        # Auth version 1.0
        # deprecated
        key = request.POST.get('key')

        if not key:
            return HttpResponseForbidden('Invalid credentials')

        try:
            key = base64.b64decode(key)
        except Exception, e:
            logger.exception('Bad data received')
            return HttpResponseForbidden('Bad data decoding key (%s, %s)' % (e.__class__.__name__, e))


        if key != settings.KEY:
            warnings.warn('A client is sending the `key` parameter, which will be removed in Sentry 2.0', DeprecationWarning)
            return HttpResponseForbidden('Invalid credentials')

        data = request.POST.get('data')
        if not data:
            return HttpResponseBadRequest('Missing data')

        format = request.POST.get('format', 'pickle')

        if format not in ('pickle', 'json'):
            return HttpResponseBadRequest('Invalid format')

        project = None

    try:
        try:
            data = base64.b64decode(data).decode('zlib')
        except zlib.error:
            data = base64.b64decode(data)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.exception('Bad data received')
        return HttpResponseForbidden('Bad data decoding request (%s, %s)' % (e.__class__.__name__, e))

    try:
        if format == 'pickle':
            data = pickle.loads(data)
        elif format == 'json':
            data = json.loads(data)
    except Exception, e:
        # This error should be caught as it suggests that there's a
        # bug somewhere in the client's code.
        logger.exception('Bad data received')
        return HttpResponseForbidden('Bad data reconstructing object (%s, %s)' % (e.__class__.__name__, e))

    # XXX: ensure keys are coerced to strings
    data = dict((smart_str(k), v) for k, v in data.iteritems())

    if 'timestamp' in data:
        if is_float(data['timestamp']):
            try:
                data['timestamp'] = datetime.datetime.fromtimestamp(float(data['timestamp']))
            except:
                logger.exception('Failed reading timestamp')
                del data['timestamp']
        elif not isinstance(data['timestamp'], datetime.datetime):
            if '.' in data['timestamp']:
                format = '%Y-%m-%dT%H:%M:%S.%f'
            else:
                format = '%Y-%m-%dT%H:%M:%S'
            if 'Z' in data['timestamp']:
                # support GMT market, but not other timestamps
                format += 'Z'
            try:
                data['timestamp'] = datetime.datetime.strptime(data['timestamp'], format)
            except:
                logger.exception('Failed reading timestamp')
                del data['timestamp']

    # Confirm they're using either the master key, or their specified project matches with the
    # signed project.
    if project and str(data.get('project', '')) != str(project.pk):
        return HttpResponseForbidden('Invalid credentials')
    elif not project:
        data['project'] = 1

    GroupedMessage.objects.from_kwargs(**data)

    return HttpResponse()