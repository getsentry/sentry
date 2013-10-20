"""
sentry.web.frontend.projects.general
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


@has_access
def get_started(request, team, project):
    return render_to_response('sentry/get_started.html', {
        'project': project,
        'team': project.team,
    }, request)
