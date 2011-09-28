"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import re

from django.conf import settings as dj_settings
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse, resolve
from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseRedirect, Http404, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_protect

from sentry.conf import settings
from sentry.models import GroupedMessage, Message, Project
from sentry.plugins import GroupActionProvider
from sentry.templatetags.sentry_helpers import with_priority
from sentry.utils import get_filters, json
from sentry.utils.stacks import get_template_info

uuid_re = re.compile(r'^[a-z0-9]{32}$')

def get_project_list(user=None):
    """
    Returns a set of all projects a user has some level of access to.
    """
    projects = set(Project.objects.filter(public=True))
    if user.is_authenticated():
        projects.update(set(Project.objects.filter(member_set__user=user)))
    return projects

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
        if uuid_re.match(query):
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

    projects = get_project_list(request.user)

    message_list = GroupedMessage.objects.filter(Q(project__in=projects) | Q(project__isnull=True))

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

@login_required
def ajax_handler(request):
    op = request.REQUEST.get('op')

    def notification(request):
        return render_to_response('sentry/partial/_notification.html', request.GET)

    def poll(request):
        filters = []
        for filter_ in get_filters():
            filters.append(filter_(request))

        projects = get_project_list(request.user)

        message_list = GroupedMessage.objects.filter(Q(project__in=projects) | Q(project__isnull=True))

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

        if group.project and group.project not in get_project_list(request.user):
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
        projects = get_project_list(request.user)

        message_list = GroupedMessage.objects.filter(Q(project__in=projects) | Q(project__isnull=True))

        message_list.update(status=1)

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

        if group.project and group.project not in get_project_list(request.user):
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

    if group.project and group.project not in get_project_list(request.user):
        return HttpResponseForbidden()

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

    if group.project and group.project not in get_project_list(request.user):
        return HttpResponseForbidden()

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

    if group.project and group.project not in get_project_list(request.user):
            return HttpResponseForbidden()

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
