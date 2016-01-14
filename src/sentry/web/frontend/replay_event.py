from __future__ import absolute_import

import urlparse

from django.core.urlresolvers import reverse

from sentry.models import Event
from sentry.replays import Replayer
from sentry.utils.http import safe_urlencode
from sentry.web.forms import ReplayForm
from sentry.web.frontend.base import ProjectView


class ReplayEventView(ProjectView):
    required_scope = 'event:read'

    def handle(self, request, organization, project, team, group_id, event_id):
        try:
            event = Event.objects.get(group_id=group_id, id=event_id)
        except Event.DoesNotExist:
            return self.redirect(reverse('sentry'))

        Event.objects.bind_nodes([event], 'data')

        interfaces = event.interfaces
        if 'sentry.interfaces.Http' not in interfaces:
            # TODO: show a proper error
            return self.redirect(reverse('sentry'))

        # TODO(mattrobenolt): Add Cookie as a header
        http = interfaces['sentry.interfaces.Http']
        if http.headers:
            headers = '\n'.join('%s: %s' % (k, v) for k, v in http.headers if k[0].upper() == k[0])
        else:
            headers = ''

        if isinstance(http.data, dict):
            data = safe_urlencode(http.data)
        else:
            data = http.data

        initial = {
            'url': urlparse.urldefrag(http.full_url)[0],
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
            'group': event.group,
            'event': event,
            'form': form,
            'result': result,
        }

        return self.respond('sentry/events/replay_request.html', context)
