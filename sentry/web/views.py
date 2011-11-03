"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import base64
import datetime
import logging
import re
import time
import warnings
import zlib

from django.conf import settings as dj_settings
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseRedirect, Http404, HttpResponseNotModified, \
    HttpResponseGone
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils.encoding import smart_str
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.views.decorators.http import require_http_methods

from sentry.conf import settings
from sentry.models import GroupedMessage, Message
from sentry.plugins import GroupActionProvider
from sentry.templatetags.sentry_helpers import with_priority
from sentry.utils import get_filters, is_float, get_signature, parse_auth_header, json
from sentry.utils.compat import pickle
from sentry.utils.stacks import get_template_info

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
message_re = re.compile(r'^(?P<message_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)

_LOGIN_URL = None
def get_login_url(reset=False):
    global _LOGIN_URL

    if _LOGIN_URL is None or reset:
        # if LOGIN_URL resolves force login_required to it instead of our own
        # XXX: this must be done as late as possible to avoid idempotent requirements
        try:
            resolve(dj_settings.LOGIN_URL)
        except:
            _LOGIN_URL = settings.LOGIN_URL
        else:
            _LOGIN_URL = dj_settings.LOGIN_URL

        if _LOGIN_URL is None:
             _LOGIN_URL = reverse('sentry-login')
    return _LOGIN_URL

def iter_data(obj):
    for k, v in obj.data.iteritems():
        if k.startswith('_') or k in ['url']:
            continue
        yield k, v

def render_to_response(template, context={}, status=200):
    from django.shortcuts import render_to_response

    context.update({
        'has_search': bool(settings.SEARCH_ENGINE),
    })

    response = render_to_response(template, context)
    response.status_code = status
    return response

def get_search_query_set(query):
    from haystack.query import SearchQuerySet
    from sentry.search_indexes import site, backend

    class SentrySearchQuerySet(SearchQuerySet):
        "Returns actual instances rather than search results."

        def __getitem__(self, k):
            result = []
            for r in super(SentrySearchQuerySet, self).__getitem__(k):
                inst = r.object
                if not inst:
                    continue
                inst.score = r.score
                result.append(inst)
            return result

    return SentrySearchQuerySet(
        site=site,
        query=backend.SearchQuery(backend=site.backend),
    ).filter(content=query)

def login_required(func):
    def wrapped(request, *args, **kwargs):
        if not settings.PUBLIC:
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm('sentry.can_view'):
                return render_to_response('sentry/missing_permissions.html', status=400)
        return func(request, *args, **kwargs)
    wrapped.__doc__ = func.__doc__
    wrapped.__name__ = func.__name__
    return wrapped

@csrf_protect
def login(request):
    from django.contrib.auth import login as login_
    from django.contrib.auth.forms import AuthenticationForm

    if request.POST:
        form = AuthenticationForm(request, request.POST)
        if form.is_valid():
            login_(request, form.get_user())
            return HttpResponseRedirect(request.POST.get('next') or reverse('sentry'))
        else:
            request.session.set_test_cookie()
    else:
        form = AuthenticationForm(request)
        request.session.set_test_cookie()


    context = csrf(request)
    context.update({
        'form': form,
        'request': request,
    })
    return render_to_response('sentry/login.html', context)

def logout(request):
    from django.contrib.auth import logout

    logout(request)

    return HttpResponseRedirect(reverse('sentry'))

@login_required
def search(request):
    query = request.GET.get('q')
    has_search = bool(settings.SEARCH_ENGINE)

    if query:
        result = message_re.match(query)
        if result:
            # Forward to message if it exists
            # message_id = result.group(1)
            checksum = result.group(2)
            message_list = GroupedMessage.objects.filter(checksum=checksum)
            top_matches = message_list[:2]
            if len(top_matches) == 0:
                if not has_search:
                    return render_to_response('sentry/invalid_message_id.html')
                else:
                    message_list = get_search_query_set(query)
            elif len(top_matches) == 1:
                return HttpResponseRedirect(top_matches[0].get_absolute_url())
        elif uuid_re.match(query):
            # Forward to message if it exists
            try:
                message = Message.objects.get(message_id=query)
            except Message.DoesNotExist:
                if not has_search:
                    return render_to_response('sentry/invalid_message_id.html')
                else:
                    message_list = get_search_query_set(query)
            else:
                return HttpResponseRedirect(message.get_absolute_url())
        elif not has_search:
            return render_to_response('sentry/invalid_message_id.html')
        else:
            message_list = get_search_query_set(query)
    else:
        message_list = GroupedMessage.objects.none()

    sort = request.GET.get('sort')
    if sort == 'date':
        message_list = message_list.order_by('-last_seen')
    elif sort == 'new':
        message_list = message_list.order_by('-first_seen')
    else:
        sort = 'relevance'

    return render_to_response('sentry/search.html', {
        'message_list': message_list,
        'query': query,
        'sort': sort,
        'request': request,
    })

@login_required
def index(request):
    filters = []
    for filter_ in get_filters():
        filters.append(filter_(request))

    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    message_list = GroupedMessage.objects.all()

    sort = request.GET.get('sort')
    if sort == 'date':
        message_list = message_list.order_by('-last_seen')
    elif sort == 'new':
        message_list = message_list.order_by('-first_seen')
    elif sort == 'freq':
        message_list = message_list.order_by('-times_seen')
    else:
        sort = 'priority'
        message_list = message_list.order_by('-score', '-last_seen')

    # Filters only apply if we're not searching
    any_filter = False
    for filter_ in filters:
        if not filter_.is_set():
            continue
        any_filter = True
        message_list = filter_.get_query_set(message_list)

    today = datetime.datetime.now()

    has_realtime = page == 1

    return render_to_response('sentry/index.html', {
        'has_realtime': has_realtime,
        'message_list': message_list,
        'today': today,
        'sort': sort,
        'any_filter': any_filter,
        'request': request,
        'filters': filters,
    })

@csrf_exempt
@login_required
def ajax_handler(request):
    op = request.REQUEST.get('op')

    def notification(request):
        return render_to_response('sentry/partial/_notification.html', request.GET)

    def poll(request):
        filters = []
        for filter_ in get_filters():
            filters.append(filter_(request))

        message_list = GroupedMessage.objects.all()

        sort = request.GET.get('sort')
        if sort == 'date':
            message_list = message_list.order_by('-last_seen')
        elif sort == 'new':
            message_list = message_list.order_by('-first_seen')
        elif sort == 'freq':
            message_list = message_list.order_by('-times_seen')
        else:
            sort = 'priority'
            message_list = message_list.order_by('-score', '-last_seen')

        for filter_ in filters:
            if not filter_.is_set():
                continue
            message_list = filter_.get_query_set(message_list)

        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {
                    'group': m,
                    'priority': p,
                    'request': request,
                }).strip(),
                'title': m.view or m.message_top(),
                'message': m.error(),
                'level': m.get_level_display(),
                'logger': m.logger,
                'count': m.times_seen,
                'priority': p,
            }) for m, p in with_priority(message_list[0:15])]

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    def resolve(request):
        gid = request.REQUEST.get('gid')
        if not gid:
            return HttpResponseForbidden()
        try:
            group = GroupedMessage.objects.get(pk=gid)
        except GroupedMessage.DoesNotExist:
            return HttpResponseForbidden()

        GroupedMessage.objects.filter(pk=group.pk).update(status=1)
        group.status = 1

        if not request.is_ajax():
            return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {
                    'group': m,
                    'request': request,
                }).strip(),
                'count': m.times_seen,
            }) for m in [group]]

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    def clear(request):
        GroupedMessage.objects.all().update(status=1)

        if not request.is_ajax():
            return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

        data = []
        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    def chart(request):
        gid = request.REQUEST.get('gid')
        if not gid:
            return HttpResponseForbidden()

        try:
            group = GroupedMessage.objects.get(pk=gid)
        except GroupedMessage.DoesNotExist:
            return HttpResponseForbidden()
        data = GroupedMessage.objects.get_chart_data(group)

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    if op in ['notification', 'poll', 'resolve', 'clear', 'chart']:
        return locals()[op](request)
    else:
        return HttpResponseBadRequest()

@login_required
def group(request, group_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    try:
        obj = group.message_set.all().order_by('-id')[0]
    except IndexError:
        # It's possible that a message would not be created under certain circumstances
        # (such as a post_save signal failing)
        obj = Message(group=group, data=group.data)

    # template information
    template_info = None
    # exception information
    exc_type, exc_value = None, None
    # stack frames
    frames = None
    # module versions
    version_data = None
    user_data = None

    if '__sentry__' in obj.data:
        sentry_data = obj.data['__sentry__']
        if 'exc' in sentry_data:
            module, args, frames = sentry_data['exc']
        elif 'exception' in sentry_data:
            module, args = sentry_data['exception']
        else:
            module, args = None, None

        if 'frames' in sentry_data:
            frames = sentry_data['frames']

        if 'user' in sentry_data:
            user_data = sentry_data['user']

        if module and args:
            # We fake the exception class due to many issues with imports/builtins/etc
            exc_type = obj.class_name
            exc_value = type(str(obj.class_name), (Exception,), {})(obj.message)
            exc_value.args = args

        if 'template' in sentry_data:
            template_info = get_template_info(sentry_data['template'], exc_value)

        if 'versions' in sentry_data:
            version_data = sorted(sentry_data['versions'].iteritems())

    if frames:
        lastframe = frames[-1]
    else:
        lastframe = None

    return render_to_response('sentry/group/details.html', {
        'page': 'details',
        'group': group,
        'message': obj,
        'json_data': iter_data(obj),
        'user_data': user_data,
        'version_data': version_data,
        'frames': frames,
        'lastframe': lastframe,
        'template_info': template_info,
        'exception_type': exc_type,
        'exception_value': exc_value,
        'request': request,
    })

@login_required
def group_message_list(request, group_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    message_list = group.message_set.all().order_by('-datetime')

    return render_to_response('sentry/group/message_list.html', {
        'group': group,
        'message_list': message_list,
        'page': 'messages',
        'request': request
    })

@login_required
def group_message_details(request, group_id, message_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    message = get_object_or_404(group.message_set, pk=message_id)

    # template information
    template_info = None
    # exception information
    exc_type, exc_value = None, None
    # stack frames
    frames = None
    lastframe = None
    # module versions
    version_data = None
    user_data = None

    if '__sentry__' in message.data:
        sentry_data = message.data['__sentry__']
        if 'exc' in sentry_data:
            module, args, frames = sentry_data['exc']
        elif 'exception' in sentry_data:
            module, args = sentry_data['exception']
        else:
            module, args = None, None

        if 'frames' in sentry_data:
            frames = sentry_data['frames']

        if 'user' in sentry_data:
            user_data = sentry_data['user']

        if module and args:
            # We fake the exception class due to many issues with imports/builtins/etc
            exc_type = message.class_name
            exc_value = type(str(message.class_name), (Exception,), {})(message.message)
            exc_value.args = args

        if 'template' in sentry_data:
            template_info = get_template_info(sentry_data['template'], exc_value)

        if 'versions' in sentry_data:
            version_data = sorted(sentry_data['versions'].iteritems())

    if frames:
        lastframe = frames[-1]
    else:
        lastframe = None

    return render_to_response('sentry/group/message.html', {
        'page': 'messages',
        'group': group,
        'message': message,
        'json_data': iter_data(message),
        'user_data': user_data,
        'version_data': version_data,
        'frames': frames,
        'lastframe': lastframe,
        'template_info': template_info,
        'exception_type': exc_type,
        'exception_value': exc_value,
        'request': request,
    })

@csrf_exempt
@require_http_methods(['POST'])
def store(request):
    if request.META.get('HTTP_AUTHORIZATION', '').startswith('Sentry'):
        auth_vars = parse_auth_header(request.META['HTTP_AUTHORIZATION'])

        signature = auth_vars.get('sentry_signature')
        timestamp = auth_vars.get('sentry_timestamp')

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

            sig_hmac = get_signature(data, timestamp)
            if sig_hmac != signature:
                return HttpResponseForbidden('Invalid signature')
        else:
            return HttpResponse('Unauthorized', status_code=401)
    else:
        # Legacy request (deprecated as of 2.0)
        key = request.POST.get('key')

        if not key:
            return HttpResponseForbidden('Invalid credentials')

        if key != settings.KEY:
            warnings.warn('A client is sending the `key` parameter, which will be removed in Sentry 2.0', DeprecationWarning)
            return HttpResponseForbidden('Invalid credentials')

        data = request.POST.get('data')
        if not data:
            return HttpResponseBadRequest('Missing data')

        format = request.POST.get('format', 'pickle')

        if format not in ('pickle', 'json'):
            return HttpResponseBadRequest('Invalid format')

    logger = logging.getLogger('sentry.server')

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

    GroupedMessage.objects.from_kwargs(**data)

    return HttpResponse()

@login_required
def group_plugin_action(request, group_id, slug):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    try:
        cls = GroupActionProvider.plugins[slug]
    except KeyError:
        raise Http404('Plugin not found')
    response = cls(group_id)(request, group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry'))

def static_media(request, path):
    """
    Serve static files below a given point in the directory structure.
    """
    from django.utils.http import http_date
    from django.views.static import was_modified_since
    import mimetypes
    import os.path
    import posixpath
    import stat
    import urllib

    document_root = os.path.join(settings.ROOT, 'static')

    path = posixpath.normpath(urllib.unquote(path))
    path = path.lstrip('/')
    newpath = ''
    for part in path.split('/'):
        if not part:
            # Strip empty path components.
            continue
        drive, part = os.path.splitdrive(part)
        head, part = os.path.split(part)
        if part in (os.curdir, os.pardir):
            # Strip '.' and '..' in path.
            continue
        newpath = os.path.join(newpath, part).replace('\\', '/')
    if newpath and path != newpath:
        return HttpResponseRedirect(newpath)
    fullpath = os.path.join(document_root, newpath)
    if os.path.isdir(fullpath):
        raise Http404("Directory indexes are not allowed here.")
    if not os.path.exists(fullpath):
        raise Http404('"%s" does not exist' % fullpath)
    # Respect the If-Modified-Since header.
    statobj = os.stat(fullpath)
    mimetype = mimetypes.guess_type(fullpath)[0] or 'application/octet-stream'
    if not was_modified_since(request.META.get('HTTP_IF_MODIFIED_SINCE'),
                              statobj[stat.ST_MTIME], statobj[stat.ST_SIZE]):
        return HttpResponseNotModified(mimetype=mimetype)
    contents = open(fullpath, 'rb').read()
    response = HttpResponse(contents, mimetype=mimetype)
    response["Last-Modified"] = http_date(statobj[stat.ST_MTIME])
    response["Content-Length"] = len(contents)
    return response
