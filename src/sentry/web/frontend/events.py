"""
sentry.web.frontend.events
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import logging

from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.models import Event
from sentry.filters import get_filters
from sentry.replays import Replayer
from sentry.utils.http import safe_urlencode
from sentry.web.decorators import login_required, has_access, render_to_response
from sentry.web.forms import ReplayForm


@login_required
@has_access
def event_list(request, team, project):
    filters = []
    for cls in get_filters(Event, project):
        try:
            filters.append(cls(request, project))
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error initializing filter %r: %s', cls, e)

    event_list = Event.objects.filter(project=project).order_by('-datetime')

    # TODO: implement separate API for messages
    for filter_ in filters:
        try:
            if not filter_.is_set():
                continue
            event_list = filter_.get_query_set(event_list)
        except Exception, e:
            logger = logging.getLogger('sentry.filters')
            logger.exception('Error processing filter %r: %s', cls, e)

    today = datetime.date.today()

    has_realtime = False

    return render_to_response('sentry/events/event_list.html', {
        'team': team,
        'project': project,
        'has_realtime': has_realtime,
        'event_list': event_list,
        'today': today,
        'filters': filters,
        'PAGE': 'stream',
    }, request)


@has_access
@csrf_protect
def replay_event(request, team, project, event_id, group_id=None):
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
        'team': team,
        'project': project,
        'group': event.group,
        'event': event,
        'form': form,
        'result': result,
    }
    context.update(csrf(request))

    return render_to_response('sentry/events/replay_request.html', context, request)
