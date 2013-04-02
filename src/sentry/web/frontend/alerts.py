"""
sentry.web.frontend.alerts
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division

from datetime import timedelta

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils import timezone

from sentry.constants import STATUS_RESOLVED, STATUS_UNRESOLVED
from sentry.models import Alert
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response


@login_required
@has_access
def alert_list(request, team, project=None):
    alert_list = Alert.objects.filter(
        group__isnull=True,
        status=STATUS_UNRESOLVED,
        datetime__gte=timezone.now() - timedelta(days=3),
    ).order_by('-datetime')

    if project:
        alert_list = alert_list.filter(project=project)
        template = 'sentry/alerts/list.html'
    else:
        alert_list = alert_list.filter(
            project__team=team,
        ).select_related('project')
        template = 'sentry/alerts/team.html'

    return render_to_response(template, {
        'team': team,
        'project': project,
        'alert_list': list(alert_list[:20]),
        'SECTION': 'alerts',
    }, request)


@login_required
@has_access
def alert_details(request, team, project, alert_id):
    try:
        alert = Alert.objects.get(id=alert_id, project=project)
    except Alert.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-alerts', args=[team.slug, project.slug]))

    related_group_list = list(alert.related_groups.order_by('-score', '-times_seen'))

    return render_to_response('sentry/alerts/details.html', {
        'team': team,
        'project': project,
        'alert': alert,
        'related_group_list': related_group_list,
        'SECTION': 'alerts',
    }, request)


@login_required
@has_access
def resolve_alert(request, team, project, alert_id):
    try:
        alert = Alert.objects.get(id=alert_id, project=project)
    except Alert.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-alerts', args=[team.slug, project.slug]))

    alert.update(status=STATUS_RESOLVED)

    return HttpResponseRedirect(reverse('sentry-alert-details', args=[team.slug, project.slug, alert.id]))
