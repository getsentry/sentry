import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import datetime
import logging
import zlib

from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseForbidden, HttpResponseRedirect, Http404
from django.shortcuts import render_to_response, get_object_or_404
from django.template.loader import render_to_string
from django.utils import simplejson
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_protect, csrf_exempt

from sentry import conf
from sentry.helpers import get_filters
from sentry.models import GroupedMessage, Message
from sentry.plugins import GroupActionProvider
from sentry.templatetags.sentry_helpers import with_priority
from sentry.reporter import ImprovedExceptionReporter

def login_required(func):
    def wrapped(request, *args, **kwargs):
        if not conf.PUBLIC:
            if not request.user.is_authenticated():
                return HttpResponseRedirect(reverse('sentry-login'))
            if not request.user.has_perm('sentry_groupedmessage.can_view'):
                return HttpResponseRedirect(reverse('sentry-login'))
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

    
    context = locals()
    context.update(csrf(request))
    return render_to_response('sentry/login.html', locals())

def logout(request):
    from django.contrib.auth import logout
    
    logout(request)
    
    return HttpResponseRedirect(reverse('sentry'))

@login_required
def index(request):
    filters = []
    for filter_ in get_filters():
        filters.append(filter_(request))
    
    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    # this only works in postgres
    message_list = GroupedMessage.objects.extra(
        select={
            'score': GroupedMessage.get_score_clause(),
        }
    )

    sort = request.GET.get('sort')
    if sort == 'date':
        message_list = message_list.order_by('-last_seen')
    elif sort == 'new':
        message_list = message_list.order_by('-first_seen')
    else:
        sort = 'priority'
        message_list = message_list.order_by('-score', '-last_seen')

    
    any_filter = False
    for filter_ in filters:
        if not filter_.is_set():
            continue
        any_filter = True
        message_list = filter_.get_query_set(message_list)
    
    today = datetime.datetime.now()

    has_realtime = page == 1
    
    return render_to_response('sentry/index.html', locals())

@login_required
def ajax_handler(request):
    op = request.REQUEST.get('op')

    if op == 'poll':
        filters = []
        for filter_ in get_filters():
            filters.append(filter_(request))

        message_list = GroupedMessage.objects.extra(
            select={
                'score': GroupedMessage.get_score_clause(),
            }
        )
        
        sort = request.GET.get('sort')
        if sort == 'date':
            message_list = message_list.order_by('-last_seen')
        elif sort == 'new':
            message_list = message_list.order_by('-first_seen')
        else:
            sort = 'priority'
            message_list = message_list.order_by('-score', '-last_seen')
        
        for filter_ in filters:
            if not filter_.is_set():
                continue
            message_list = filter_.get_query_set(message_list)
        
        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {'group': m, 'priority': p}),
                'count': m.times_seen,
                'priority': p,
            }) for m, p in with_priority(message_list[0:15])]

    elif op == 'resolve':
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
            return HttpResponseRedirect(request.META['HTTP_REFERER'])
        
        data = [
            (m.pk, {
                'html': render_to_string('sentry/partial/_group.html', {'group': m}),
                'count': m.times_seen,
            }) for m in [group]]
    else:
        return HttpResponseBadRequest()
        
    response = HttpResponse(simplejson.dumps(data))
    response['Content-Type'] = 'application/json'
    return response

@login_required
def group(request, group_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    obj = group.message_set.all().order_by('-id')[0]
    if '__sentry__' in obj.data:
        module, args, frames = obj.data['__sentry__']['exc']
        obj.class_name = str(obj.class_name)
        # We fake the exception class due to many issues with imports/builtins/etc
        exc_type = type(obj.class_name, (Exception,), {})
        exc_value = exc_type(obj.message)

        exc_value.args = args
    
        reporter = ImprovedExceptionReporter(obj.request, exc_type, exc_value, frames, obj.data['__sentry__'].get('template'))
        traceback = mark_safe(reporter.get_traceback_html())
    elif group.traceback:
        traceback = mark_safe('<pre>%s</pre>' % (group.traceback,))
    
    def iter_data(obj):
        for k, v in obj.data.iteritems():
            if k.startswith('_') or k in ['url']:
                continue
            yield k, v
    
    json_data = iter_data(obj)
    
    page = 'details'
    
    return render_to_response('sentry/group/details.html', locals())

@login_required
def group_message_list(request, group_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    message_list = group.message_set.all().order_by('-datetime')
    
    page = 'messages'
    
    return render_to_response('sentry/group/message_list.html', locals())

@login_required
def group_message_details(request, group_id, message_id):
    group = get_object_or_404(GroupedMessage, pk=group_id)

    message = get_object_or_404(group.message_set, pk=message_id)
    
    if '__sentry__' in message.data:
        module, args, frames = message.data['__sentry__']['exc']
        message.class_name = str(message.class_name)
        # We fake the exception class due to many issues with imports/builtins/etc
        exc_type = type(message.class_name, (Exception,), {})
        exc_value = exc_type(message.message)

        exc_value.args = args
    
        reporter = ImprovedExceptionReporter(message.request, exc_type, exc_value, frames, message.data['__sentry__'].get('template'))
        traceback = mark_safe(reporter.get_traceback_html())
    elif group.traceback:
        traceback = mark_safe('<pre>%s</pre>' % (group.traceback,))
    
    def iter_data(obj):
        for k, v in obj.data.iteritems():
            if k.startswith('_') or k in ['url']:
                continue
            yield k, v
    
    json_data = iter_data(message)
    
    page = 'messages'
    
    return render_to_response('sentry/group/message.html', locals())

@csrf_exempt
def store(request):
    key = request.POST.get('key')
    if key != conf.KEY:
        return HttpResponseForbidden('Invalid credentials')
    
    data = request.POST.get('data')
    if not data:
        return HttpResponseForbidden('Missing data')
    try:
        try:
            data = pickle.loads(base64.b64decode(data).decode('zlib'))
        except zlib.error:
            data = pickle.loads(base64.b64decode(data))
    except Exception:
        return HttpResponseForbidden('Bad data')

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
    return HttpResponseRedirect(request.META['HTTP_REFERER'])