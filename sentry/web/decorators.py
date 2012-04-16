from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.conf import settings
from sentry.models import Project, Team
from sentry.web.helpers import get_project_list, render_to_response, \
  get_login_url, get_team_list


def has_access(group_or_func=None):
    """
    Tests and transforms project_id for permissions based on the requesting
    user. Passes the actual project instance to the decorated view.

    The default permission scope is 'user', which
    allows both 'user' and 'owner' access, but not 'system agent'.

    >>> @has_access(MEMBER_OWNER)
    >>> def foo(request, project):
    >>>     return

    >>> @has_access
    >>> def foo(request, project):
    >>>     return
    """
    if callable(group_or_func):
        return has_access(None)(group_or_func)

    def wrapped(func):
        @wraps(func)
        def _wrapped(request, project_id=None, *args, **kwargs):
            # XXX: if project_id isn't set, should we only allow superuser?
            if project_id.isdigit():
                lookup_kwargs = {'id': int(project_id)}
            else:
                lookup_kwargs = {'slug': project_id}

            if request.user.is_superuser:
                if project_id:
                    try:
                        project = Project.objects.get_from_cache(**lookup_kwargs)
                    except Project.DoesNotExist:
                        return HttpResponseRedirect(reverse('sentry'))
                else:
                    project = None
                return func(request, project, *args, **kwargs)

            if project_id:
                key, value = lookup_kwargs.items()[0]
                project_list = get_project_list(request.user, group_or_func, key=key)
                try:
                    project = project_list[value]
                except (KeyError, ValueError):
                    return HttpResponseRedirect(reverse('sentry'))
            else:
                project = None

            return func(request, project, *args, **kwargs)
        return _wrapped
    return wrapped


def has_team_access(group_or_func=None):
    """
    Tests and transforms team_id for permissions based on the requesting
    user. Passes the actual project instance to the decorated view.

    The default permission scope is 'user', which
    allows both 'user' and 'owner' access, but not 'system agent'.

    >>> @has_team_access(MEMBER_OWNER)
    >>> def foo(request, team):
    >>>     return

    >>> @has_team_access
    >>> def foo(request, team):
    >>>     return
    """
    if callable(group_or_func):
        return has_team_access(None)(group_or_func)

    def wrapped(func):
        @wraps(func)
        def _wrapped(request, team_slug, *args, **kwargs):
            if request.user.is_superuser:
                try:
                    team = Team.objects.get_from_cache(slug=team_slug)
                except Team.DoesNotExist:
                    return HttpResponseRedirect(reverse('sentry'))
                return func(request, team, *args, **kwargs)

            team_list = get_team_list(request.user, group_or_func)
            print team_slug
            try:
                team = team_list[team_slug]
            except (KeyError, ValueError):
                return HttpResponseRedirect(reverse('sentry'))

            return func(request, team, *args, **kwargs)
        return _wrapped
    return wrapped


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not settings.PUBLIC:
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
        return func(request, *args, **kwargs)
    return wrapped


def requires_admin(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            return HttpResponseRedirect(get_login_url())
        if not request.user.is_staff:
            return render_to_response('sentry/missing_permissions.html', status=400)
        return func(request, *args, **kwargs)
    return wrapped


def permission_required(perm):
    def wrapped(func):
        @wraps(func)
        def _wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm(perm):
                return render_to_response('sentry/missing_permissions.html', status=400)
            return func(request, *args, **kwargs)
        return _wrapped
    return wrapped
