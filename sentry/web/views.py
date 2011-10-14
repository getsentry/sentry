"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import datetime
import re

from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseRedirect, Http404, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_protect

from sentry.conf import settings
from sentry.models import Group, Event, Project
from sentry.plugins import GroupActionProvider
from sentry.templatetags.sentry_helpers import with_priority
from sentry.utils import get_filters, json
from sentry.utils.template_info import get_template_info
from sentry.web.forms import EditProjectForm
from sentry.web.helpers import login_required, render_to_response, get_search_query_set, \
    get_project_list, iter_data

uuid_re = re.compile(r'^[a-z0-9]{32}$', re.I)
message_re = re.compile(r'^(?P<message_id>[a-z0-9]{32})\$(?P<checksum>[a-z0-9]{32})$', re.I)

def can_manage(perm_or_func=None):
    """
    Tests and transforms project_id for permissions based on the requesting user. Passes
    the actual project instance to the decorated view.

    >>> @can_manage('read_message')
    >>> def foo(request, project):
    >>>     return

    >>> @can_manage
    >>> def foo(request, project):
    >>>     return
    """
    if callable(perm_or_func):
        return can_manage(None)(perm_or_func)

    def wrapped(func):
        def _wrapped(request, project_id=None, *args, **kwargs):
            # XXX: if project_id isn't set, should we only allow superuser?
            if request.user.is_superuser:
                if project_id:
                    try:
                        project = Project.objects.get(pk=project_id)
                    except Project.DoesNotExist:
                        return HttpResponseRedirect(reverse('sentry'))
                else:
                    project = None
                return func(request, project, *args, **kwargs)

            if project_id:
                project_list = get_project_list(request.user, perm_or_func)

                try:
                    project = project_list[int(project_id)]
                except (KeyError, ValueError):
                    return HttpResponseRedirect(reverse('sentry'))
            else:
                project = None

            return func(request, project, *args, **kwargs)
        return _wrapped
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
def ajax_handler(request):
    # TODO: remove this awful idea of an API
    op = request.REQUEST.get('op')

    def notification(request):
        return render_to_response('sentry/partial/_notification.html', request.GET)

    def poll(request):
        filters = []
        for filter_ in get_filters():
            filters.append(filter_(request))

        projects = get_project_list(request.user, 'read_message')

        message_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

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
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        if group.project and group.project.pk not in get_project_list(request.user, 'change_message_status'):
            return HttpResponseForbidden()

        Group.objects.filter(pk=group.pk).update(status=1)
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
        projects = get_project_list(request.user, 'change_message_status')

        message_list = Group.objects.filter(Q(project__in=projects.keys()) | Q(project__isnull=True))

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
            group = Group.objects.get(pk=gid)
        except Group.DoesNotExist:
            return HttpResponseForbidden()

        if group.project and group.project.pk not in get_project_list(request.user, 'read_message'):
            return HttpResponseForbidden()

        data = Group.objects.get_chart_data(group)

        response = HttpResponse(json.dumps(data))
        response['Content-Type'] = 'application/json'
        return response

    if op in ['notification', 'poll', 'resolve', 'clear', 'chart']:
        return locals()[op](request)
    else:
        return HttpResponseBadRequest()

@login_required
@can_manage('read_message')
def search(request, project):
    query = request.GET.get('q')
    has_search = bool(settings.SEARCH_ENGINE)

    if query:
        result = message_re.match(query)
        if result:
            # Forward to message if it exists
            # message_id = result.group(1)
            checksum = result.group(2)
            try:
                message = Group.objects.get(checksum=checksum)
            except Group.DoesNotExist:
                if not has_search:
                    return render_to_response('sentry/invalid_message_id.html')
                else:
                    message_list = get_search_query_set(query)
            else:
                return HttpResponseRedirect(message.get_absolute_url())
        elif uuid_re.match(query):
            # Forward to message if it exists
            try:
                message = Event.objects.get(message_id=query)
            except Event.DoesNotExist:
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
        message_list = Group.objects.none()

    sort = request.GET.get('sort')
    if sort == 'date':
        message_list = message_list.order_by('-last_seen')
    elif sort == 'new':
        message_list = message_list.order_by('-first_seen')
    else:
        sort = 'relevance'

    return render_to_response('sentry/search.html', {
        'project': project,
        'message_list': message_list,
        'query': query,
        'sort': sort,
        'request': request,
    })

@login_required
def dashboard(request):
    return render_to_response('sentry/dashboard.html', {
        'request': request,
    })

@login_required
@can_manage('read_message')
def index(request, project):
    filters = []
    for filter_ in get_filters():
        filters.append(filter_(request))

    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    message_list = Group.objects.filter(project=project)

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
        'project': project,
        'has_realtime': has_realtime,
        'message_list': message_list,
        'today': today,
        'sort': sort,
        'any_filter': any_filter,
        'request': request,
        'filters': filters,
    })

@login_required
@can_manage('read_message')
def group(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group', kwargs={'group_id': group.pk, 'project_id': group.project_id}))

    try:
        obj = group.message_set.all().order_by('-id')[0]
    except IndexError:
        # It's possible that a message would not be created under certain circumstances
        # (such as a post_save signal failing)
        obj = Event(group=group, data=group.data)

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
        'project': project,
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
@can_manage('read_message')
def group_message_list(request, project, group_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-messages', kwargs={'group_id': group.pk, 'project_id': group.project_id}))

    message_list = group.message_set.all().order_by('-datetime')

    return render_to_response('sentry/group/message_list.html', {
        'project': project,
        'group': group,
        'message_list': message_list,
        'page': 'messages',
        'request': request
    })

@login_required
@can_manage('read_message')
def group_message_details(request, project, group_id, message_id):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-message', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'message_id': message_id}))

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
        'project': project,
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
@can_manage('read_message')
def group_plugin_action(request, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id)

    if group.project and group.project != project:
        return HttpResponseRedirect(reverse('sentry-group-action', kwargs={'group_id': group.pk, 'project_id': group.project_id, 'slug': slug}))

    try:
        cls = GroupActionProvider.plugins[slug]
    except KeyError:
        raise Http404('Plugin not found')
    response = cls(group_id)(request, group)
    if response:
        return response
    return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('sentry', kwargs={'project_id': group.project_id}))

@login_required
def project_list(request):
    return render_to_response('sentry/projects/list.html', {
        'project_list': get_project_list(request.user),
        'request': request,
    })

@login_required
@can_manage
def manage_project(request, project):
    form = EditProjectForm(request.POST or None, instance=project)
    if form.is_valid():
        project = form.save()

    context = csrf(request)
    context.update({
        'form': form,
        'project': project,
        'project_list': project_list.values(),
        'request': request,
    })

    return render_to_response('sentry/projects/manage.html', context)

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
