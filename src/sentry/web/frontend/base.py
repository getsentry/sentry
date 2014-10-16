from __future__ import absolute_import

from django.core.context_processors import csrf
from django.http import Http404, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.generic import View

from sentry.models import Organization, Project, Team
from sentry.web.helpers import get_login_url


class OrganizationMixin(object):
    def get_active_organization(self, request, organization_id=None,
                                access=None):
        """
        Returns the currently active organization for the request or None
        if no organization.
        """
        active_organization = None

        is_implicit = organization_id is None

        if is_implicit:
            organization_id = request.session.get('activeorg')

        if organization_id is not None:
            if request.user.is_superuser:
                try:
                    active_organization = Organization.objects.get_from_cache(
                        id=organization_id,
                    )
                except Organization.DoesNotExist:
                    return None
            else:
                organizations = Organization.objects.get_for_user(
                    user=request.user,
                    access=access,
                )

                try:
                    active_organization = (
                        o for o in organizations
                        if o.id == organization_id
                    ).next()
                except StopIteration:
                    if is_implicit:
                        del request.session['activeorg']
                    active_organization = None

        if active_organization is None:
            if not is_implicit:
                return None

            try:
                active_organization = organizations[0]
            except IndexError:
                pass

        return active_organization

    def get_active_team(self, request, team_slug, access=None):
        """
        Returns the currently selected team for the request or None
        if no match.
        """
        if request.user.is_superuser:
            try:
                return Team.objects.get_from_cache(slug=team_slug)
            except Team.DoesNotExist:
                return None

        team_list = Team.objects.get_for_user(
            user=request.user,
            access=access,
        )

        try:
            return team_list[team_slug]
        except KeyError:
            return None

    def get_active_project(self, request, team, project_slug, access=None):
        if request.user.is_superuser:
            try:
                return Project.objects.get_from_cache(
                    slug=project_slug,
                    team=team,
                )
            except Project.DoesNotExist:
                return None

        project_list = Project.objects.get_for_user(
            user=request.user,
            team=team,
            access=access,
        )

        try:
            return (
                p for p in project_list
                if p.slug == project_slug
            ).next()
        except StopIteration:
            return None


class BaseView(View, OrganizationMixin):
    @method_decorator(csrf_protect)
    def dispatch(self, request, *args, **kwargs):
        self.request = request
        self.default_context = self.get_context_data(request, *args, **kwargs)
        return super(BaseView, self).dispatch(request, *args, **kwargs)

    def get_context_data(self, request, **kwargs):
        context = csrf(request)
        return context

    def respond(self, template, request, context=None):
        default_context = self.default_context
        if context:
            default_context.update(context)

        return render_with_response(template, default_context, self.request)


class OrganizationView(BaseView):
    """
    Any view acting on behalf of an organization should inherit from this base.

    The 'organization' keyword argument is automatically injected into the
    resulting dispatch.
    """
    required_access = None

    def get_context_data(self, request, organization, **kwargs):
        context = super(OrganizationView, self).get_context_data()
        context['organization'] = organization
        return context

    def dispatch(self, request, organization_id=None, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            return HttpResponseRedirect(get_login_url())

        # TODO:
        # if access is MEMBER_OWNER:
        #     _wrapped = login_required(sudo_required(_wrapped))

        active_organization = self.get_active_organization(
            request=request,
            access=self.required_access,
            organization_id=organization_id,
        )
        if active_organization is None:
            # TODO
            raise Http404

        kwargs['organization'] = active_organization

        return super(OrganizationView, self).dispatch(request, *args, **kwargs)


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
        context = super(TeamView, self).get_context_data()
        context['organization'] = organization
        context['team'] = team
        return context

    def dispatch(self, request, team_slug, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            return HttpResponseRedirect(get_login_url())

        active_team = self.get_active_team(
            request=request,
            team_slug=team_slug,
            access=self.required_access,
        )
        if active_team is None:
            # TODO
            raise Http404

        kwargs['team'] = active_team
        kwargs['organization'] = active_team.organization

        return super(TeamView, self).dispatch(request, *args, **kwargs)


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
        context = super(TeamView, self).get_context_data()
        context['organization'] = organization
        context['project'] = project
        context['team'] = team
        return context

    def dispatch(self, request, team_slug, project_slug, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            return HttpResponseRedirect(get_login_url())

        active_team = self.get_active_team(
            request=request,
            team_slug=team_slug,
        )
        if active_team is None:
            # TODO
            raise Http404

        active_project = self.get_active_project(
            request=request,
            team=active_team,
            project_slug=project_slug,
            access=self.required_access,
        )
        if active_project is None:
            # TODO
            raise Http404

        kwargs['project'] = active_project
        kwargs['team'] = active_team
        kwargs['organization'] = active_team.organization

        return super(ProjectView, self).dispatch(request, *args, **kwargs)
