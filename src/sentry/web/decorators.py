from __future__ import absolute_import

import logging
import warnings

from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.shortcuts import get_object_or_404
from sudo.decorators import sudo_required

from sentry.constants import MEMBER_OWNER
from sentry.models import Organization, Project, Team, Group
from sentry.web.helpers import (
    render_to_response, get_login_url)


def has_access(access_or_func=None, organization=None, access=None):
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
    # TODO(dcramer): this code is far too hacky these days and should
    # be replaced with class based views

    if callable(access_or_func):
        return has_access(None)(access_or_func)

    access = access_or_func

    def wrapped(func):
        warnings.warn(
            '%s.%s is used deprecated @has_access' % (func.__module__, func.__name__),
            DeprecationWarning)

        @wraps(func)
        def _wrapped(request, *args, **kwargs):
            # All requests require authentication
            if not request.user.is_authenticated():
                request.session['_next'] = request.get_full_path()
                if request.is_ajax():
                    return HttpResponse(status=401)
                return HttpResponseRedirect(get_login_url())

            has_org = 'organization_slug' in kwargs
            has_team = 'team_slug' in kwargs
            has_project = 'project_id' in kwargs

            organization_slug = kwargs.pop('organization_slug', None)
            team_slug = kwargs.pop('team_slug', None)
            project_id = kwargs.pop('project_id', None)

            assert not has_team or has_org, \
                'Must pass organization_slug with team_slug'

            if organization_slug:
                if not request.user.is_superuser:
                    if has_team or has_project:
                        org_access = None
                    else:
                        org_access = access
                    org_list = Organization.objects.get_for_user(
                        user=request.user,
                        access=org_access,
                    )

                    for o in org_list:
                        if o.slug == organization_slug:
                            organization = o
                            break
                    else:
                        logging.debug('User %s is not listed in organization with slug %s', request.user.id, organization_slug)
                        if request.is_ajax():
                            return HttpResponse(status=400)
                        return HttpResponseRedirect(reverse('sentry'))

                else:
                    try:
                        organization = Organization.objects.get_from_cache(
                            slug=organization_slug,
                        )
                    except Organization.DoesNotExist:
                        logging.debug('Organization with slug %s does not exist', organization_slug)
                        if request.is_ajax():
                            return HttpResponse(status=400)
                        return HttpResponseRedirect(reverse('sentry'))

            else:
                organization = None

            if team_slug:
                if not request.user.is_superuser:
                    team_list = Team.objects.get_for_user(
                        user=request.user,
                        access=access,
                        organization=organization,
                    )

                    for t in team_list:
                        if t.slug == team_slug:
                            team = t
                            break
                    else:
                        logging.debug('User %s is not listed in team with slug %s', request.user.id, team_slug)
                        if request.is_ajax():
                            return HttpResponse(status=400)
                        return HttpResponseRedirect(reverse('sentry'))

                else:
                    try:
                        team = Team.objects.get_from_cache(
                            slug=team_slug,
                            organization=organization,
                        )
                    except Team.DoesNotExist:
                        logging.debug('Team with slug %s does not exist', team_slug)
                        if request.is_ajax():
                            return HttpResponse(status=400)
                        return HttpResponseRedirect(reverse('sentry'))

            else:
                team = None

            if project_id:
                # Support project id's
                if project_id.isdigit():
                    lookup_kwargs = {'id': int(project_id)}
                elif organization:
                    lookup_kwargs = {'slug': project_id, 'organization': organization}
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
                            if request.is_ajax():
                                return HttpResponse(status=400)
                            return HttpResponseRedirect(reverse('sentry'))
                    else:
                        if request.is_ajax():
                            return HttpResponse(status=400)
                        return HttpResponseRedirect(reverse('sentry'))

                if not request.user.is_superuser and not project.has_access(request.user, access=access):
                    if request.is_ajax():
                        return HttpResponse(status=400)
                    return HttpResponseRedirect(reverse('sentry'))
            else:
                project = None

            if has_project:
                kwargs['project'] = project

            if has_team:
                kwargs['team'] = team

            if has_org:
                kwargs['organization'] = organization

            return func(request, *args, **kwargs)

        if access == MEMBER_OWNER:
            _wrapped = login_required(sudo_required(_wrapped))
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
        def wrapped(request, organization_slug, project_id, group_id, *args, **kwargs):
            group = get_object_or_404(Group, pk=group_id)

            if project_id not in (group.project.slug, str(group.project.id)):
                return HttpResponse(status=404)

            if allow_public and (group.is_public or group.project.public):
                organization = Organization.objects.get_from_cache(slug=organization_slug)
                group.project.organization = organization
                return func(request, organization=organization, project=group.project, group=group, *args, **kwargs)

            return prv_func(request, organization_slug=organization_slug, project_id=project_id, group=group, *args, **kwargs)
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
