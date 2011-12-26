"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings as dj_settings
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponse
from django.template import loader

from sentry.conf import settings
from sentry.models import ProjectMember, Project


def get_project_list(user=None, flag=None):
    """
    Returns a set of all projects a user has some level of access to.
    """
    projects = dict((p.pk, p) for p in Project.objects.filter(public=True))
    if user.is_authenticated():
        projects.update(dict(
            (pm.project_id, pm.project)
            for pm in ProjectMember.objects.filter(user=user).select_related('project')
            if (not flag or pm.has_perm(flag))))
    return projects

_LOGIN_URL = None


def get_login_url(reset=False):
    global _LOGIN_URL

    if _LOGIN_URL is None or reset:
        # if LOGIN_URL resolves force login_required to it instead of our own
        # XXX: this must be done as late as possible to avoid idempotent requirements
        try:
            resolve(dj_settings.LOGIN_URL)
        except:
            _LOGIN_URL = settings.LOGIN_URL
        else:
            _LOGIN_URL = dj_settings.LOGIN_URL

        if _LOGIN_URL is None:
            _LOGIN_URL = reverse('sentry-login')
    return _LOGIN_URL


def iter_data(obj):
    for k, v in obj.data.iteritems():
        if k.startswith('_') or k in ['url']:
            continue
        yield k, v


def render_to_string(template, context=None, request=None):
    if context is None:
        context = {}
    context.update({
        'has_search': False,
        'MESSAGES_PER_PAGE': settings.MESSAGES_PER_PAGE,
    })
    if request:
        context.update({
            'request': request,
            'project_list': get_project_list(request.user).values(),
        })

    return loader.render_to_string(template, context)


def render_to_response(template, context=None, request=None, status=200):
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status

    return response
