from __future__ import absolute_import

from django.http import HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse

from sentry.models import Event


def event_redirect(request, organization_slug, client_event_id):
    """
    Given a client event id and organization slug, redirects to the event page
    """
    try:
        event = Event.objects.select_related('project').get(event_id=client_event_id)
    except Event.DoesNotExist:
        raise Http404()

    return HttpResponseRedirect(
        reverse(
            'sentry-group-event',
            args=[
                organization_slug,
                event.project.slug,
                event.group_id,
                event.id])
    )
