"""
sentry.web.views
~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings as dj_settings
from django.core.urlresolvers import reverse, resolve
from django.http import HttpResponseRedirect

from sentry.conf import settings
from sentry.models import Project, ProjectMember

def get_project_list(user=None, flag=None):
    """
    Returns a set of all projects a user has some level of access to.
    """
    projects = set(Project.objects.filter(public=True))
    if user.is_authenticated():
        pms = list(ProjectMember.objects.filter(user=user).select_related('project'))
        if flag:
            pms = filter(lambda x: x.has_perm(flag), pms)
        projects.update(set(pms))
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

def render_to_response(template, context={}, status=200):
    from django.shortcuts import render_to_response

    context.update({
        'has_search': bool(settings.SEARCH_ENGINE),
    })

    response = render_to_response(template, context)
    response.status_code = status
    return response

def get_search_query_set(query):
    from haystack.query import SearchQuerySet
    from sentry.search_indexes import site, backend

    class SentrySearchQuerySet(SearchQuerySet):
        "Returns actual instances rather than search results."

        def __getitem__(self, k):
            result = []
            for r in super(SentrySearchQuerySet, self).__getitem__(k):
                inst = r.object
                if not inst:
                    continue
                inst.score = r.score
                result.append(inst)
            return result

    return SentrySearchQuerySet(
        site=site,
        query=backend.SearchQuery(backend=site.backend),
    ).filter(content=query)

def login_required(func):
    def wrapped(request, *args, **kwargs):
        if not settings.PUBLIC:
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm('sentry.can_view'):
                return render_to_response('sentry/missing_permissions.html', status=400)
        return func(request, *args, **kwargs)
    wrapped.__doc__ = func.__doc__
    wrapped.__name__ = func.__name__
    return wrapped
