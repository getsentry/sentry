from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.conf import settings
from sentry.models import Project
from sentry.web.helpers import get_project_list, render_to_response, \
  get_login_url


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
        def _wrapped(request, project_id=None, *args, **kwargs):
            # XXX: if project_id isn't set, should we only allow superuser?
            if request.user.is_superuser:
                if project_id:
                    try:
                        project = Project.objects.get(pk=project_id)
                    except Project.DoesNotExist:
                        return HttpResponseRedirect(reverse('sentry'))
                else:
                    project = None
                return func(request, project, *args, **kwargs)

            if project_id:
                project_list = get_project_list(request.user, group_or_func)
                try:
                    project = project_list[int(project_id)]
                except (KeyError, ValueError):
                    return HttpResponseRedirect(reverse('sentry'))
            else:
                project = None

            return func(request, project, *args, **kwargs)
        return _wrapped
    return wrapped


def login_required(func):
    def wrapped(request, *args, **kwargs):
        if not settings.PUBLIC:
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
        return func(request, *args, **kwargs)
    wrapped.__doc__ = func.__doc__
    wrapped.__name__ = func.__name__
    return wrapped


def permission_required(perm):
    def wrapped(func):
        def _wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated():
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm(perm):
                return render_to_response('sentry/missing_permissions.html', status=400)
            return func(request, *args, **kwargs)
        _wrapped.__doc__ = func.__doc__
        _wrapped.__name__ = func.__name__
        return _wrapped
    return wrapped
