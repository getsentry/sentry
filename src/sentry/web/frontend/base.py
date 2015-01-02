from __future__ import absolute_import

import logging

from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.generic import View
from sudo.views import redirect_to_sudo

from sentry.models import (
    Organization, OrganizationMember, OrganizationMemberType,
    OrganizationStatus, Project, Team
)
from sentry.web.helpers import get_login_url, render_to_response


class Access(object):
    def __init__(self, is_global, type):
        self.is_global = is_global
        self.type = type

    def has_access(self, type):
        return self.type <= type

    @property
    def is_admin(self):
        return self.has_access(OrganizationMemberType.ADMIN)

    @property
    def is_owner(self):
        return self.has_access(OrganizationMemberType.OWNER)


class OrganizationMixin(object):
    def get_active_organization(self, request, organization_slug=None,
                                access=None):
        """
        Returns the currently active organization for the request or None
        if no organization.
        """
        active_organization = None

        is_implicit = organization_slug is None

        if is_implicit:
            organization_slug = request.session.get('activeorg')

        if organization_slug is not None:
            if request.user.is_superuser:
                try:
                    active_organization = Organization.objects.get_from_cache(
                        slug=organization_slug,
                    )
                    if active_organization.status != OrganizationStatus.VISIBLE:
                        raise Organization.DoesNotExist
                except Organization.DoesNotExist:
                    logging.info('Active organization [%s] not found',
                                 organization_slug)
                    return None

        if active_organization is None:
            organizations = Organization.objects.get_for_user(
                user=request.user,
                access=access,
            )

        if active_organization is None and organization_slug:
            try:
                active_organization = (
                    o for o in organizations
                    if o.slug == organization_slug
                ).next()
            except StopIteration:
                logging.info('Active organization [%s] not found in scope',
                             organization_slug)
                if is_implicit:
                    del request.session['activeorg']
                active_organization = None

        if active_organization is None:
            if not is_implicit:
                return None

            try:
                active_organization = organizations[0]
            except IndexError:
                logging.info('User is not a member of any organizations')
                pass

        if active_organization and active_organization.slug != request.session.get('activeorg'):
            request.session['activeorg'] = active_organization.slug

        return active_organization

    def get_active_team(self, request, organization, team_slug, access=None):
        """
        Returns the currently selected team for the request or None
        if no match.
        """
        try:
            team = Team.objects.get_from_cache(
                slug=team_slug,
                organization=organization,
            )
        except Team.DoesNotExist:
            return None

        if not request.user.is_superuser and not team.has_access(request.user, access):
            return None

        return team

    def get_active_project(self, request, organization, project_slug, access=None):
        try:
            project = Project.objects.get_from_cache(
                slug=project_slug,
                organization=organization,
            )
        except Project.DoesNotExist:
            return None

        if not request.user.is_superuser and not project.has_access(request.user, access):
            return None

        return project


class BaseView(View, OrganizationMixin):
    auth_required = True
    # TODO(dcramer): change sudo so it can be required only on POST
    sudo_required = False

    @method_decorator(csrf_protect)
    def dispatch(self, request, *args, **kwargs):
        if self.auth_required and not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            return self.redirect(get_login_url())

        if self.sudo_required and not request.is_sudo():
            return redirect_to_sudo(request.get_full_path())

        args, kwargs = self.convert_args(request, *args, **kwargs)

        if not self.has_permission(request, *args, **kwargs):
            redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
            return self.redirect(redirect_uri)

        self.request = request
        self.default_context = self.get_context_data(request, *args, **kwargs)

        return self.handle(request, *args, **kwargs)

    def convert_args(self, request, *args, **kwargs):
        return (args, kwargs)

    def handle(self, request, *args, **kwargs):
        return super(BaseView, self).dispatch(request, *args, **kwargs)

    def get_no_permission_url(request, *args, **kwargs):
        return reverse('sentry')

    def has_permission(self, request, *args, **kwargs):
        return True

    def get_context_data(self, request, **kwargs):
        context = csrf(request)
        return context

    def respond(self, template, context=None, status=200):
        default_context = self.default_context
        if context:
            default_context.update(context)

        return render_to_response(template, default_context, self.request,
                                  status=status)

    def redirect(self, url):
        return HttpResponseRedirect(url)

    def get_team_list(self, user, organization):
        return Team.objects.get_for_user(
            organization=organization,
            user=user,
            with_projects=True,
        )


class OrganizationView(BaseView):
    """
    Any view acting on behalf of an organization should inherit from this base.

    The 'organization' keyword argument is automatically injected into the
    resulting dispatch.
    """
    required_access = None

    def get_context_data(self, request, organization, **kwargs):
        context = super(OrganizationView, self).get_context_data(request)
        context['organization'] = organization
        context['TEAM_LIST'] = self.get_team_list(request.user, organization)

        if request.user.is_superuser:
            access = Access(is_global=True, type=OrganizationMemberType.OWNER)
        else:
            om = OrganizationMember.objects.get(
                user=request.user, organization=organization
            )
            access = Access(is_global=om.has_global_access, type=om.type)

        context['ACCESS'] = access

        return context

    def has_permission(self, request, organization, *args, **kwargs):
        return organization is not None

    def convert_args(self, request, organization_slug=None, *args, **kwargs):
        # TODO:
        # if access is MEMBER_OWNER:
        #     _wrapped = login_required(sudo_required(_wrapped))

        active_organization = self.get_active_organization(
            request=request,
            access=self.required_access,
            organization_slug=organization_slug,
        )

        kwargs['organization'] = active_organization

        return (args, kwargs)


class TeamView(BaseView):
    """
    Any view acting on behalf of a team should inherit from this base and the
    matching URL pattern must pass 'team_slug'.

    Two keyword arguments are added to the resulting dispatch:

    - organization
    - team
    """
    required_access = None

    def get_context_data(self, request, organization, team, **kwargs):
        context = super(TeamView, self).get_context_data(request)
        context['organization'] = organization
        context['team'] = team
        context['TEAM_LIST'] = self.get_team_list(request.user, organization)
        return context

    def has_permission(self, request, organization, team, *args, **kwargs):
        return team is not None

    def convert_args(self, request, organization_slug, team_slug, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request,
            organization_slug=organization_slug,
        )

        if active_organization:
            active_team = self.get_active_team(
                request=request,
                team_slug=team_slug,
                organization=active_organization,
                access=self.required_access,
            )
        else:
            active_team = None

        kwargs['organization'] = active_organization
        kwargs['team'] = active_team

        return (args, kwargs)


class ProjectView(BaseView):
    """
    Any view acting on behalf of a project should inherit from this base and the
    matching URL pattern must pass 'team_slug' as well as 'project_slug'.

    Three keyword arguments are added to the resulting dispatch:

    - organization
    - team
    - project
    """
    required_access = None

    def get_context_data(self, request, organization, team, project, **kwargs):
        context = super(ProjectView, self).get_context_data(request)
        context['organization'] = organization
        context['project'] = project
        context['team'] = team
        context['TEAM_LIST'] = self.get_team_list(request.user, organization)
        return context

    def has_permission(self, request, organization, team, project, *args, **kwargs):
        return project is not None

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request,
            organization_slug=organization_slug,
        )

        if active_organization:
            active_project = self.get_active_project(
                request=request,
                organization=active_organization,
                project_slug=project_slug,
                access=self.required_access,
            )
        else:
            active_project = None

        if active_project:
            active_team = active_project.team
        else:
            active_team = None

        kwargs['project'] = active_project
        kwargs['team'] = active_team
        kwargs['organization'] = active_organization

        return (args, kwargs)
