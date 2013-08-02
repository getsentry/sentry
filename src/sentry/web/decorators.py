from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.shortcuts import get_object_or_404

from sentry.models import Project, Team, Group
from sentry.web.helpers import (
    render_to_response, get_login_url)


def has_access(access_or_func=None, team=None, access=None):
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
    if callable(access_or_func):
        return has_access(None)(access_or_func)

    access = access_or_func

    def wrapped(func):
        @wraps(func)
        def _wrapped(request, *args, **kwargs):
            # All requests require authentication
            if not request.user.is_authenticated():
                request.session['_next'] = request.get_full_path()
                return HttpResponseRedirect(get_login_url())

            has_team = 'team_slug' in kwargs
            has_project = 'project_id' in kwargs

            team_slug = kwargs.pop('team_slug', None)
            project_id = kwargs.pop('project_id', None)

            # Pull in team if it's part of the URL arguments
            if team_slug:
                if request.user.is_superuser:
                    try:
                        team = Team.objects.get_from_cache(slug=team_slug)
                    except Team.DoesNotExist:
                        return HttpResponseRedirect(reverse('sentry'))
                else:
                    team_list = Team.objects.get_for_user(request.user, access)

                    try:
                        team = team_list[team_slug]
                    except KeyError:
                        return HttpResponseRedirect(reverse('sentry'))
            else:
                team = None

            if project_id:
                # Support project id's
                if request.user.is_superuser:
                    if project_id.isdigit():
                        lookup_kwargs = {'id': int(project_id)}
                    elif team:
                        lookup_kwargs = {'slug': project_id, 'team': team}
                    else:
                        return HttpResponseRedirect(reverse('sentry'))

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
                    project_list = Project.objects.get_for_user(request.user, access, team=team)

                    if project_id.isdigit():
                        key = 'id'
                        value = int(project_id)
                    elif team:
                        key = 'slug'
                        value = project_id
                    else:
                        return HttpResponseRedirect(reverse('sentry'))

                    for p in project_list:
                        if getattr(p, key) == value:
                            project = p
                            break
                    else:
                        return HttpResponseRedirect(reverse('sentry'))
            else:
                project = None

            if has_project:
                # ensure we're accessing this url correctly
                if project and team:
                    if project.team_id != team.id:
                        return HttpResponseRedirect(reverse('sentry'))
                    project._team_cache = team

                kwargs['project'] = project

            if has_team:
                kwargs['team'] = team

            return func(request, *args, **kwargs)
        return _wrapped
    return wrapped


def has_group_access(func=None, **kwargs):
    """
    Tests and transforms project_id and group_id for permissions based on
    the requesting user. Passes the actual project and group instances to
    the decorated view.

    >>> @has_group_access(allow_public=True)
    >>> def foo(request, project, group):
    >>>     return
    """
    if func:
        return has_group_access(**kwargs)(func)

    allow_public = kwargs.get('allow_public')

    def decorator(func):
        prv_func = login_required(has_access(func))

        @wraps(func)
        def wrapped(request, team_slug, project_id, group_id, *args, **kwargs):
            group = get_object_or_404(Group, pk=group_id)

            if project_id not in (group.project.slug, str(group.project.id)):
                return HttpResponse(status=404)
            if team_slug != group.team.slug:
                return HttpResponse(status=404)

            if allow_public and (group.is_public or group.project.public):
                team = Team.objects.get_from_cache(slug=team_slug)
                return func(request, team=team, project=group.project, group=group, *args, **kwargs)

            return prv_func(request, team_slug=team_slug, project_id=project_id, group=group, *args, **kwargs)
        return wrapped
    return decorator


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            return HttpResponseRedirect(get_login_url())
        return func(request, *args, **kwargs)
    return wrapped


def requires_admin(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
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
                request.session['_next'] = request.get_full_path()
                return HttpResponseRedirect(get_login_url())
            if not request.user.has_perm(perm):
                return render_to_response('sentry/missing_permissions.html', status=400)
            return func(request, *args, **kwargs)
        return _wrapped
    return wrapped
