"""
sentry.web.frontend.alerts
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division


from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect


from sentry.models import Alert

from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response


@login_required
@has_access
def alert_list(request, team, project):
    alert_list = Alert.objects.filter(project=project, group__isnull=True).order_by('-datetime')

    return render_to_response('sentry/alerts/list.html', {
        'team': team,
        'project': project,
        'alert_list': alert_list,
        'SECTION': 'events',
    }, request)


@login_required
@has_access
def alert_details(request, team, project, alert_id):
    try:
        alert = Alert.objects.get(id=alert_id, project=project)
    except Alert.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-project-alerts', args=[team.slug, project.slug]))

    related_group_list = list(alert.related_groups.order_by('-score', '-times_seen'))

    return render_to_response('sentry/alerts/details.html', {
        'team': team,
        'project': project,
        'alert': alert,
        'related_group_list': related_group_list,
        'SECTION': 'events',
    }, request)
