"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import pkg_resources
import sys

from django.core.urlresolvers import reverse
from django.db.models import Sum
from django.http import HttpResponseRedirect, Http404, HttpResponseNotModified, \
  HttpResponse
from djkombu.models import Queue

from sentry import environment
from sentry.conf import settings
from sentry.plugins import Plugin
from sentry.web.decorators import login_required
from sentry.web.helpers import get_project_list, render_to_response, \
  get_login_url, plugin_config


@login_required
def dashboard(request):
    project_list = get_project_list(request.user)
    if len(project_list) == 1:
        return HttpResponseRedirect(reverse('sentry', kwargs={'project_id': project_list.keys()[0]}))
    if len(project_list) == 0 and not request.user.is_authenticated():
        return HttpResponseRedirect(get_login_url())
    return render_to_response('sentry/dashboard.html', request=request)


@login_required
def status(request):
    from sentry.views import View
    from sentry.processors import Processor

    if not request.user.is_staff:
        return HttpResponseRedirect(reverse('sentry'))

    # Deal with the plugins
    site_configs = []
    for slug, title in request.plugins.for_site():
        plugin = request.plugins[slug]
        action, view = plugin_config(plugin, None, request)
        if action == 'redirect':
            return HttpResponseRedirect(request.path)
        item = {
            'plugin': plugin,
            'title': plugin.get_title(),
            'slug': plugin.slug,
            'site_conf_title': plugin.get_conf_title(),
            'view': view,
        }
        site_configs.append(item)

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

    return render_to_response('sentry/status.html', {
        'config': config,
        'environment': environment,
        'python_version': sys.version,
        'modules': sorted([(p.project_name, p.version) for p in pkg_resources.working_set]),
        'extensions': [(cls.title, cls.__module__.rsplit('.', 1)[0]) for cls in Plugin.plugins.itervalues()],
        'views': [(x.__class__.__name__, x.__module__) for x in View.handlers.all()],
        'processors': [(x.__class__.__name__, x.__module__) for x in Processor.handlers.all()],
        'pending_tasks': pending_tasks,
        'worker_status': worker_status,
        'site_configs': site_configs,
    }, request)


def static_media(request, path, root=None):
    """
    Serve static files below a given point in the directory structure.
    """
    from django.utils.http import http_date
    from django.views.static import was_modified_since
    import mimetypes
    import os.path
    import posixpath
    import stat
    import urllib

    document_root = root or os.path.join(settings.ROOT, 'static')

    path = posixpath.normpath(urllib.unquote(path))
    path = path.lstrip('/')
    newpath = ''
    for part in path.split('/'):
        if not part:
            # Strip empty path components.
            continue
        drive, part = os.path.splitdrive(part)
        head, part = os.path.split(part)
        if part in (os.curdir, os.pardir):
            # Strip '.' and '..' in path.
            continue
        newpath = os.path.join(newpath, part).replace('\\', '/')
    if newpath and path != newpath:
        return HttpResponseRedirect(newpath)
    fullpath = os.path.join(document_root, newpath)
    if os.path.isdir(fullpath):
        raise Http404("Directory indexes are not allowed here.")
    if not os.path.exists(fullpath):
        raise Http404('"%s" does not exist' % fullpath)
    # Respect the If-Modified-Since header.
    statobj = os.stat(fullpath)
    mimetype = mimetypes.guess_type(fullpath)[0] or 'application/octet-stream'
    if not was_modified_since(request.META.get('HTTP_IF_MODIFIED_SINCE'),
                              statobj[stat.ST_MTIME], statobj[stat.ST_SIZE]):
        return HttpResponseNotModified(mimetype=mimetype)
    contents = open(fullpath, 'rb').read()
    response = HttpResponse(contents, mimetype=mimetype)
    response["Last-Modified"] = http_date(statobj[stat.ST_MTIME])
    response["Content-Length"] = len(contents)
    return response
