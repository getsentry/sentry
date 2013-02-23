"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.http import HttpResponseRedirect
from django.contrib.staticfiles import finders
from django.core.urlresolvers import reverse
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext as _

from sentry.models import Team
from sentry.permissions import can_create_teams
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response


def find_static_files(ignore_patterns=()):
    found_files = SortedDict()
    for finder in finders.get_finders():
        for path, storage in finder.list(ignore_patterns):
            found_files[path] = storage.path(path)
    return found_files


@login_required
def dashboard(request, template='dashboard.html'):
    team_list = Team.objects.get_for_user(request.user)
    if not team_list:
        if can_create_teams(request.user):
            return HttpResponseRedirect(reverse('sentry-new-team'))

        return render_to_response('sentry/generic_error.html', {
            'title': _('No Membership'),
            'message': _('You are not a member of any teams in Sentry and you do not have access to create a new team.'),
        }, request)

    # This cookie gets automatically set by render_to_response
    last_team = request.session.get('team')
    if last_team in team_list:
        team = team_list[last_team]
    else:
        team = team_list.values()[0]

    # Redirect to first team
    # TODO: maybe store this in a cookie and redirect to last seen team?
    return HttpResponseRedirect(reverse('sentry', args=[team.slug]))


def wall_display(request):
    return dashboard(request, 'wall.html')


def static_media(request, **kwargs):
    """
    Serve static files below a given point in the directory structure.
    """
    from django.contrib.staticfiles.views import serve

    module = kwargs.get('module')
    path = kwargs.get('path', '')

    if module:
        path = '%s/%s' % (module, path)

    return serve(request, path, insecure=True)
