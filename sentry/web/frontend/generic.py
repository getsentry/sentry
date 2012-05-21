"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime

from django.http import HttpResponseRedirect, Http404, HttpResponseNotModified, \
  HttpResponse

from sentry.conf import settings
from sentry.models import Group
from sentry.web.decorators import login_required
from sentry.web.helpers import get_project_list, render_to_response, \
  get_login_url


@login_required
def dashboard(request):
    project_list = get_project_list(request.user, key='slug')
    if len(project_list) == 0 and not request.user.is_authenticated():
        return HttpResponseRedirect(get_login_url())

    if project_list:
        cutoff = datetime.datetime.now() - datetime.timedelta(days=1)
        base_qs = Group.objects.filter(
            project__in=project_list.values(),
            status=0,
        ).select_related('project').order_by('-score')

        # TODO: change this to calculate the most frequent events in the time period,
        # not just events seen within the time period that have at one time been frequent
        top_event_list = list(base_qs.filter(
            last_seen__gte=cutoff
        )[:10])

        new_event_list = list(base_qs.filter(
            active_at__gte=cutoff,
        )[:10])
    else:
        top_event_list = None
        new_event_list = None

    return render_to_response('sentry/dashboard.html', {
        'top_event_list': top_event_list,
        'new_event_list': new_event_list,
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

    document_root = root or os.path.join(settings.MODULE_ROOT, 'static')

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
