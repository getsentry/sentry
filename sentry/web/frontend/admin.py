"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import pkg_resources
import sys

from django.core.urlresolvers import reverse
from django.db.models import Sum
from django.http import HttpResponseRedirect
from djkombu.models import Queue

from sentry import environment
from sentry.conf import settings
from sentry.models import Project, MessageCountByMinute
from sentry.plugins import plugins
from sentry.web.decorators import requires_admin
from sentry.web.helpers import render_to_response, plugin_config


def configure_plugin(request, slug):
    plugin = plugins.get(slug)
    if not plugin.has_site_conf():
        return HttpResponseRedirect(reverse('sentry'))

    action, view = plugin_config(plugin, None, request)
    if action == 'redirect':
        return HttpResponseRedirect(request.path)

    return render_to_response('sentry/admin/plugins/configure.html', {
        'plugin': plugin,
        'title': plugin.get_conf_title(),
        'slug': plugin.slug,
        'view': view,
    }, request)


@requires_admin
def status(request):
    from sentry.views import View

    if not request.user.is_staff:
        return HttpResponseRedirect(reverse('sentry'))

    config = []
    for k in sorted(dir(settings)):
        if k == 'KEY':
            continue
        if k.startswith('_'):
            continue
        if k.upper() != k:
            continue
        config.append((k, getattr(settings, k)))

    worker_status = (settings.QUEUE['transport'] == 'djkombu.transport.DatabaseTransport')
    if worker_status:
        pending_tasks = list(Queue.objects.filter(
            messages__visible=True,
        ).annotate(num=Sum('messages__id')).values_list('name', 'num'))
        # fetch queues which had no pending tasks
        pending_tasks.extend((q, 0) for q in Queue.objects.exclude(
            name__in=[p[0] for p in pending_tasks],
        ).values_list('name', flat=True))
    else:
        pending_tasks = None

    statistics = (
        ('Projects', Project.objects.count()),
        ('Projects (24h)', Project.objects.filter(
            date_added__gte=datetime.datetime.now() - datetime.timedelta(hours=24),
        ).count()),
        ('Events', MessageCountByMinute.objects.aggregate(x=Sum('times_seen'))['x'] or 0),
        ('Events (24h)', MessageCountByMinute.objects.filter(
            date__gte=datetime.datetime.now() - datetime.timedelta(hours=24),
        ).aggregate(x=Sum('times_seen'))['x'] or 0)
    )

    return render_to_response('sentry/admin/status.html', {
        'config': config,
        'environment': environment,
        'python_version': sys.version,
        'modules': sorted([(p.project_name, p.version) for p in pkg_resources.working_set]),
        'extensions': [(p.get_title(), '%s.%s' % (p.__module__, p.__class__.__name__)) for p in plugins.all()],
        'views': [(x.__class__.__name__, x.__module__) for x in View.objects.all()],
        'pending_tasks': pending_tasks,
        'worker_status': worker_status,
        'statistics': statistics,
    }, request)
