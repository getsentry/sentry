from __future__ import absolute_import

import logging

from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_protect
from django.views.generic import View
from sudo.views import redirect_to_sudo

from sentry.auth import access
from sentry.models import (
    Organization, OrganizationMember, OrganizationStatus, Project, ProjectStatus,
    Team, TeamStatus
)
from sentry.web.helpers import get_login_url, render_to_response

ERR_MISSING_SSO_LINK = _('You need to link your account with the SSO provider to continue.')


class OrganizationMixin(object):
    # TODO(dcramer): move the implicit organization logic into its own class
    # as it's only used in a single location and over complicates the rest of
    # the code
    def get_active_organization(self, request, organization_slug=None):
        """
        Returns the currently active organization for the request or None
        if no organization.
        """

        # TODO(dcramer): this is a huge hack, and we should refactor this
        # it is currently needed to handle the is_auth_required check on
        # OrganizationBase
        active_organization = getattr(self, '_active_org', None)
        cached_active_org = (
            active_organization
            and active_organization[0].slug == organization_slug
            and active_organization[1] == request.user
        )
        if cached_active_org:
            return active_organization[0]

        active_organization = None

        is_implicit = organization_slug is None

        if is_implicit:
            organization_slug = request.session.get('activeorg')

        if organization_slug is not None:
            if request.is_superuser():
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

        if active_organization and self._is_org_member(request.user, active_organization):
            if active_organization.slug != request.session.get('activeorg'):
                request.session['activeorg'] = active_organization.slug

        self._active_org = (active_organization, request.user)

        return active_organization

    def _is_org_member(self, user, organization):
        return OrganizationMember.objects.filter(
            user=user,
            organization=organization,
        ).exists()

    def get_active_team(self, request, organization, team_slug):
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

        if team.status != TeamStatus.VISIBLE:
            return None

        return team

    def get_active_project(self, request, organization, project_slug):
        try:
            project = Project.objects.get_from_cache(
                slug=project_slug,
                organization=organization,
            )
        except Project.DoesNotExist:
            return None

        if project.status != ProjectStatus.VISIBLE:
            return None

        return project


class BaseView(View, OrganizationMixin):
    auth_required = True
    # TODO(dcramer): change sudo so it can be required only on POST
    sudo_required = False

    def __init__(self, auth_required=None, sudo_required=None, *args, **kwargs):
        if auth_required is not None:
            self.auth_required = auth_required
        if sudo_required is not None:
            self.sudo_required = sudo_required
        super(BaseView, self).__init__(*args, **kwargs)

    @method_decorator(csrf_protect)
    def dispatch(self, request, *args, **kwargs):
        if self.is_auth_required(request, *args, **kwargs):
            return self.handle_auth_required(request, *args, **kwargs)

        if self.is_sudo_required(request, *args, **kwargs):
            return self.handle_sudo_required(request, *args, **kwargs)

        args, kwargs = self.convert_args(request, *args, **kwargs)

        request.access = self.get_access(request, *args, **kwargs)

        if not self.has_permission(request, *args, **kwargs):
            return self.handle_permission_required(request, *args, **kwargs)

        self.request = request
        self.default_context = self.get_context_data(request, *args, **kwargs)

        return self.handle(request, *args, **kwargs)

    def get_access(self, request, *args, **kwargs):
        return access.DEFAULT

    def convert_args(self, request, *args, **kwargs):
        return (args, kwargs)

    def handle(self, request, *args, **kwargs):
        return super(BaseView, self).dispatch(request, *args, **kwargs)

    def is_auth_required(self, request, *args, **kwargs):
        return (
            self.auth_required
            and not (request.user.is_authenticated() and request.user.is_active)
        )

    def handle_auth_required(self, request, *args, **kwargs):
        request.session['_next'] = request.get_full_path()
        if 'organization_slug' in kwargs:
            redirect_to = reverse('sentry-auth-organization',
                                  args=[kwargs['organization_slug']])
        else:
            redirect_to = get_login_url()
        return self.redirect(redirect_to)

    def is_sudo_required(self, request, *args, **kwargs):
        return self.sudo_required and not request.is_sudo()

    def handle_sudo_required(self, request, *args, **kwargs):
        return redirect_to_sudo(request.get_full_path())

    def has_permission(self, request, *args, **kwargs):
        return True

    def handle_permission_required(self, request, *args, **kwargs):
        redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def get_no_permission_url(request, *args, **kwargs):
        return reverse('sentry')

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
    required_scope = None
    valid_sso_required = True

    def get_access(self, request, organization, *args, **kwargs):
        if organization is None:
            return access.DEFAULT
        return access.from_request(request, organization)

    def get_context_data(self, request, organization, **kwargs):
        context = super(OrganizationView, self).get_context_data(request)
        context['organization'] = organization
        context['TEAM_LIST'] = self.get_team_list(request.user, organization)
        context['ACCESS'] = request.access.to_django_context()
        return context

    def has_permission(self, request, organization, *args, **kwargs):
        if organization is None:
            return False
        if self.valid_sso_required and not request.access.sso_is_valid:
            return False
        if self.required_scope and not request.access.has_scope(self.required_scope):
            logging.info('User %s does not have %s permission to access organization %s',
                         request.user, self.required_scope, organization)
            return False
        return True

    def is_auth_required(self, request, organization_slug=None, *args, **kwargs):
        result = super(OrganizationView, self).is_auth_required(
            request, *args, **kwargs
        )
        if result:
            return result

        # if the user is attempting to access an organization that *may* be
        # accessible if they simply re-authenticate, we want to allow that
        # this opens up a privacy hole, but the pros outweigh the cons
        if not organization_slug:
            return False

        active_organization = self.get_active_organization(
            request=request,
            organization_slug=organization_slug,
        )
        if not active_organization:
            try:
                Organization.objects.get_from_cache(slug=organization_slug)
            except Organization.DoesNotExist:
                pass
            else:
                return True
        return False

    def handle_permission_required(self, request, organization, *args, **kwargs):
        needs_link = (
            organization and request.user.is_authenticated()
            and self.valid_sso_required and not request.access.sso_is_valid
        )

        request.session['_next'] = request.get_full_path()

        if needs_link:
            messages.add_message(
                request, messages.ERROR,
                ERR_MISSING_SSO_LINK,
            )
            redirect_uri = reverse('sentry-auth-organization',
                                   args=[organization.slug])
        else:
            redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def convert_args(self, request, organization_slug=None, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request,
            organization_slug=organization_slug,
        )

        kwargs['organization'] = active_organization

        return (args, kwargs)


class TeamView(OrganizationView):
    """
    Any view acting on behalf of a team should inherit from this base and the
    matching URL pattern must pass 'team_slug'.

    Two keyword arguments are added to the resulting dispatch:

    - organization
    - team
    """
    def get_context_data(self, request, organization, team, **kwargs):
        context = super(TeamView, self).get_context_data(request, organization)
        context['team'] = team
        return context

    def has_permission(self, request, organization, team, *args, **kwargs):
        if team is None:
            return False
        rv = super(TeamView, self).has_permission(request, organization)
        if not rv:
            return rv
        if self.required_scope:
            if not request.access.has_team_scope(team, self.required_scope):
                logging.info('User %s does not have %s permission to access team %s',
                             request.user, self.required_scope, team)
                return False
        elif not request.access.has_team(team):
            logging.info('User %s does not have access to team %s',
                         request.user, team)
            return False
        return True

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
            )
        else:
            active_team = None

        kwargs['organization'] = active_organization
        kwargs['team'] = active_team

        return (args, kwargs)


class ProjectView(TeamView):
    """
    Any view acting on behalf of a project should inherit from this base and the
    matching URL pattern must pass 'team_slug' as well as 'project_slug'.

    Three keyword arguments are added to the resulting dispatch:

    - organization
    - team
    - project
    """
    def get_context_data(self, request, organization, team, project, **kwargs):
        context = super(ProjectView, self).get_context_data(request, organization, team)
        context['project'] = project
        return context

    def has_permission(self, request, organization, team, project, *args, **kwargs):
        if project is None:
            return False
        if team is None:
            return False
        rv = super(ProjectView, self).has_permission(request, organization, team)
        if not rv:
            return rv
        if self.required_scope:
            if not request.access.has_team_scope(team, self.required_scope):
                logging.info('User %s does not have %s permission to access project %s',
                             request.user, self.required_scope, project)
                return False
        elif not request.access.has_team(team):
            logging.info('User %s does not have access to project %s',
                         request.user, project)
            return False
        return True

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
