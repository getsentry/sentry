"""
sentry.web.frontend.users
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import TrackedUser
from sentry.web.decorators import login_required, has_access
from sentry.web.helpers import render_to_response

DEFAULT_SORT_OPTION = 'recent'
SORT_OPTIONS = {
    'recent': 'Last Seen',
    'newest': 'First Seen',
    'events': 'Number of Events',
}


@has_access
@login_required
def user_list(request, team):
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    # TODO: TrackedUser needs to be team-bound before we can launch it
    user_list = TrackedUser.objects.filter(project__team=team)

    if sort == 'recent':
        user_list = user_list.order_by('-last_seen')
    elif sort == 'newest':
        user_list = user_list.order_by('-first_seen')
    elif sort == 'events':
        user_list = user_list.order_by('-num_events')

    # TODO: add separate pain for unbound users (e.g. missing email addresses)
    user_list = user_list.filter(email__isnull=False)

    return render_to_response('sentry/users/list.html', {
        'tuser_list': user_list,
        'team': team,
        'sort_label': SORT_OPTIONS[sort],
        'SECTION': 'users',
        'SORT_OPTIONS': SORT_OPTIONS,
    }, request)


@has_access
@login_required
def user_details(request, team, user_id):
    user = TrackedUser.objects.get(project__team=team, id=user_id)

    event_list = user.groups.all()

    return render_to_response('sentry/users/details.html', {
        'team': team,
        'tuser': user,
        'event_list': event_list,
        'SECTION': 'users',
    }, request)
