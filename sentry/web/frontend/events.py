import datetime

from sentry.conf import settings
from sentry.models import Event
from sentry.web.decorators import login_required, can_manage, render_to_response
from sentry.utils import get_filters

@login_required
@can_manage('read_message')
def event_list(request, project):
    filters = []
    for filter_ in get_filters(Event):
        filters.append(filter_(request))

    try:
        page = int(request.GET.get('p', 1))
    except (TypeError, ValueError):
        page = 1

    event_list = Event.objects.filter(project=project).order_by('-datetime')

    # TODO: implement separate API for messages
    any_filter = False
    for filter_ in filters:
        if not filter_.is_set():
            continue
        any_filter = True
        event_list = filter_.get_query_set(event_list)

    offset = (page - 1) * settings.MESSAGES_PER_PAGE
    limit = page * settings.MESSAGES_PER_PAGE

    today = datetime.datetime.now()

    has_realtime = page == 1

    return render_to_response('sentry/events/event_list.html', {
        'project': project,
        'has_realtime': has_realtime,
        'event_list': event_list[offset:limit],
        'today': today,
        'any_filter': any_filter,
        'request': request,
        'filters': filters,
    })
