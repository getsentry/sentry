"""
sentry.web.frontend.events
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.models import Event
from sentry.replays import Replayer
from sentry.utils.http import safe_urlencode
from sentry.web.decorators import has_group_access, render_to_response
from sentry.web.forms import ReplayForm


@has_group_access
@csrf_protect
def replay_event(request, team, project, group, event_id):
    try:
        event = Event.objects.get(group=group, id=event_id)
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

    if http.query_string:
        full_url = http.url + '?' + http.query_string
    else:
        full_url = http.url

    initial = {
        'url': full_url,
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
