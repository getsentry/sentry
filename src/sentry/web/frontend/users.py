"""
sentry.web.frontend.users
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.models import TrackedUser
from sentry.web.decorators import login_required, has_access
from sentry.web.helpers import render_to_response

DEFAULT_SORT_OPTION = 'recent'
SORT_OPTIONS = ('recent', 'newest', 'events')


@has_access
@login_required
def user_list(request, project):
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    user_list = TrackedUser.objects.filter(project=project)

    if sort == 'recent':
        user_list = user_list.order_by('-last_seen')
    elif sort == 'newest':
        user_list = user_list.order_by('-first_seen')
    elif sort == 'events':
        user_list = user_list.order_by('-num_events')

    return render_to_response('sentry/users/list.html', {
        'user_list': user_list,
    }, request)
