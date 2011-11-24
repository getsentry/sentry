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
from sentry.models import Project

def get_project_list(user=None, flag=None):
    """
    Returns a set of all projects a user has some level of access to.
    """
    projects = dict((p.pk, p) for p in Project.objects.filter(public=True))
    if user.is_authenticated():
        projects.update(dict((p.pk, p) for p in Project.objects.filter(member_set__user=user) if (not flag or p.has_perm(flag))))
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

def render_to_string(template, context={}):
    context.update({
        'has_search': bool(settings.SEARCH_ENGINE),
    })

    return loader.render_to_string(template, context)

def render_to_response(template, context={}, status=200):
    response = HttpResponse(render_to_string(template, context))
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
