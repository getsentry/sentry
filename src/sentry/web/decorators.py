from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.shortcuts import get_object_or_404

from sentry.conf import settings
from sentry.models import Project, Team, Group
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
        @wraps(func)
        def _wrapped(request, project_id=None, *args, **kwargs):
            # If we're asking for anything other than implied access, the user
            # must be authenticated
            if group_or_func is not None and not request.user.is_authenticated():
                request.session['_next'] = request.build_absolute_uri()
                return HttpResponseRedirect(get_login_url())

            # XXX: if project_id isn't set, should we only allow superuser?
            if not project_id:
                return func(request, None, *args, **kwargs)

            if project_id.isdigit():
                lookup_kwargs = {'id': int(project_id)}
            else:
                lookup_kwargs = {'slug': project_id}

            if request.user.is_superuser:
                if project_id:
                    try:
                        project = Project.objects.get_from_cache(**lookup_kwargs)
                    except Project.DoesNotExist:
                        if project_id.isdigit():
                            # It could be a numerical slug
                            try:
                                project = Project.objects.get_from_cache(slug=project_id)
                            except Project.DoesNotExist:
                                return HttpResponseRedirect(reverse('sentry'))
                        else:
                            return HttpResponseRedirect(reverse('sentry'))
                else:
                    project = None

                return func(request, project, *args, **kwargs)

            if project_id:
                key, value = lookup_kwargs.items()[0]
                project_list = get_project_list(request.user, group_or_func, key=key)
                try:
                    project = project_list[value]
                except KeyError:
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

            team_list = Team.objects.get_for_user(request.user, group_or_func)
            try:
                team = team_list[team_slug]
            except KeyError:
                return HttpResponseRedirect(reverse('sentry'))

            return func(request, team, *args, **kwargs)
        return _wrapped
    return wrapped


def has_group_access(func):
    """
    Tests and transforms project_id and group_id for permissions based on
    the requesting user. Passes the actual project and group instances to
    the decorated view.

    >>> @has_group_access
    >>> def foo(request, project, group):
    >>>     return
    """
    prv_func = login_required(has_access(func))

    @wraps(func)
    def wrapped(request, project_id, group_id, *args, **kwargs):
        group = get_object_or_404(Group, pk=group_id)

        if group.project and project_id not in (group.project.slug, str(group.project.id)):
            return HttpResponse(status=404)

        if group.is_public:
            return func(request, group.project, group, *args, **kwargs)
        return prv_func(request, group.project.slug, group, *args, **kwargs)
    return wrapped


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not settings.PUBLIC:
            if not request.user.is_authenticated():
                request.session['_next'] = request.build_absolute_uri()
                return HttpResponseRedirect(get_login_url())
        return func(request, *args, **kwargs)
    return wrapped


def requires_admin(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.build_absolute_uri()
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
                request.session['_next'] = request.build_absolute_uri()
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm(perm):
                return render_to_response('sentry/missing_permissions.html', status=400)
            return func(request, *args, **kwargs)
        return _wrapped
    return wrapped
