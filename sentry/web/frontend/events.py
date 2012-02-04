"""
sentry.web.frontend.events
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime

from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.conf import settings
from sentry.models import Event
from sentry.filters import Filter
from sentry.replays import Replayer
from sentry.utils.http import safe_urlencode
from sentry.web.decorators import login_required, has_access, render_to_response
from sentry.web.forms import ReplayForm


@login_required
@has_access
def event_list(request, project):
    filters = []
    for cls in Filter.objects.filter(Event):
        filters.append(cls(request))

    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    event_list = Event.objects.filter(project=project).order_by('-datetime')

    # TODO: implement separate API for messages
    for filter_ in filters:
        if not filter_.is_set():
            continue
        event_list = filter_.get_query_set(event_list)

    offset = (page - 1) * settings.MESSAGES_PER_PAGE
    limit = page * settings.MESSAGES_PER_PAGE

    today = datetime.datetime.utcnow()

    has_realtime = False

    return render_to_response('sentry/events/event_list.html', {
        'project': project,
        'has_realtime': has_realtime,
        'event_list': event_list[offset:limit],
        'today': today,
        'filters': filters,
        'PAGE': 'stream',
    }, request)


@login_required
@csrf_protect
def replay_event(request, project_id, event_id):
    try:
        event = Event.objects.get(pk=event_id)
    except Event.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry'))

    interfaces = event.interfaces
    if 'sentry.interfaces.Http' not in interfaces:
        # TODO: show a proper error
        return HttpResponseRedirect(reverse('sentry'))

    http = interfaces['sentry.interfaces.Http']
    if http.headers:
        headers = '\n'.join('%s: %s' % (k, v) for k, v in http.headers.iteritems() if k[0].upper() == k[0])
    else:
        headers = ''

    if isinstance(http.data, dict):
        data = safe_urlencode(http.data)
    else:
        data = http.data

    initial = {
        'url': http.url,
        'method': http.method,
        'headers': headers,
        'data': data,
    }

    form = ReplayForm(request.POST or None, initial=initial)
    if form.is_valid():
        result = Replayer(
            url=form.cleaned_data['url'],
            method=form.cleaned_data['method'],
            data=form.cleaned_data['data'],
            headers=form.cleaned_data['headers'],
        ).replay()
    else:
        result = None

    context = {
        'project': event.project,
        'group': event.group,
        'event': event,
        'form': form,
        'result': result,
    }
    context.update(csrf(request))

    return render_to_response('sentry/events/replay_request.html', context, request)
