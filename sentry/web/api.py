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
import zlib

from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseGone
from django.utils.encoding import smart_str
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.conf import settings
from sentry.exceptions import InvalidData, InvalidInterface
from sentry.models import Group, ProjectMember
from sentry.utils import is_float, json
from sentry.utils.auth import get_signature, parse_auth_header
from sentry.utils.compat import pickle

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(['POST'])
def store(request):
    if request.META.get('HTTP_X_SENTRY_AUTH', '').startswith('Sentry'):
        # Auth version 3.0 (same as 2.0, diff header)
        auth_vars = parse_auth_header(request.META['HTTP_X_SENTRY_AUTH'])
    elif request.META.get('HTTP_AUTHORIZATION', '').startswith('Sentry'):
        # Auth version 2.0
        auth_vars = parse_auth_header(request.META['HTTP_AUTHORIZATION'])
    else:
        auth_vars = None

    data = request.raw_post_data

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

        # Signed data packet
        if signature and timestamp:
            try:
                timestamp_float = float(timestamp)
            except ValueError:
                return HttpResponseBadRequest('Invalid timestamp')

            if timestamp_float < time.time() - 3600:  # 1 hour
                return HttpResponseGone('Message has expired')

            sig_hmac = get_signature(data, timestamp, secret_key)
            if sig_hmac != signature:
                return HttpResponseForbidden('Invalid signature')
        else:
            return HttpResponse('Unauthorized', status=401)

    # SSL requests dont need a signature
    elif request.GET.get('api_key') and request.GET.get('project_id'):
        if not request.is_secure():
            return HttpResponse('Unauthorized', status=401)

        api_key = request.GET['api_key']
        project = request.GET['project_id']

        try:
            pm = ProjectMember.objects.get(api_key=api_key, project=project)
            if not pm.has_perm('add_message'):
                raise ProjectMember.DoesNotExist
        except ProjectMember.DoesNotExist:
            return HttpResponse('Unauthorized', status=401)

        project = pm.project

    # Support client side requests from our server from the authenticated user
    elif request.GET.get('project_id') and request.user.is_authenticated():
        try:
            pm = ProjectMember.objects.get(user=request.user, project=request.GET['project_id'])
            # TODO: do we need this check?
            # if not pm.has_perm('add_message'):
            #     raise ProjectMember.DoesNotExist
        except ProjectMember.DoesNotExist:
            return HttpResponse('Unauthorized', status=401)

        project = pm.project

    else:
        return HttpResponse('Unauthorized', status=401)

    if not data.startswith('{'):
        print "Decoding"
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
                # support UTC market, but not other timestamps
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

    try:
        Group.objects.from_kwargs(**data)
    except (InvalidInterface, InvalidData), e:
        return HttpResponseBadRequest(e)

    return HttpResponse('')
