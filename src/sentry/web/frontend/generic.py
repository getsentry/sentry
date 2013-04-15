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

from sentry.constants import STATUS_VISIBLE
from sentry.models import Team
from sentry.permissions import can_create_teams
from sentry.plugins import plugins
from sentry.plugins.base import Response
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
    if len(team_list) == 1:
        team = team_list.values()[0]
        return HttpResponseRedirect(reverse('sentry', args=[team.slug]))

    # these kinds of queries make people sad :(
    results = []
    for team in sorted(team_list.itervalues(), key=lambda x: x.name):
        project_list = list(team.project_set.filter(
            status=STATUS_VISIBLE,
        ).order_by('name')[:20])
        results.append((team, project_list))

    return render_to_response('sentry/select_team.html', {
        'team_list': results,
    }, request)


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


def missing_perm(request, perm, **kwargs):
    """
    Returns a generic response if you're missing permission to perform an
    action.

    Plugins may overwrite this with the ``missing_perm_response`` hook.
    """
    response = plugins.first('missing_perm_response', request, perm, **kwargs)

    if response:
        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, Response):
            raise NotImplementedError('Use self.render() when returning responses.')

        return response.respond(request, {
            'perm': perm,
        })

    if perm.label:
        return render_to_response('sentry/generic_error.html', {
            'title': _('Missing Permission'),
            'message': _('You do not have the required permissions to %s.') % (perm.label,)
        }, request)

    return HttpResponseRedirect(reverse('sentry'))
