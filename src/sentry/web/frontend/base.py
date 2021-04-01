import logging

from django.core.urlresolvers import reverse
from django.http import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseNotFound,
    HttpResponseRedirect,
)
from django.middleware.csrf import CsrfViewMiddleware
from django.template.context_processors import csrf
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from sudo.views import redirect_to_sudo

from sentry import roles
from sentry.api.serializers import serialize
from sentry.auth import access
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    Authenticator,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    Project,
    ProjectStatus,
    Team,
    TeamStatus,
)
from sentry.utils import auth
from sentry.utils.audit import create_audit_entry
from sentry.web.frontend.generic import FOREVER_CACHE
from sentry.web.helpers import render_to_response

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("sentry.audit.ui")


class OrganizationMixin:
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
        active_organization = getattr(self, "_active_org", None)
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
            organization_slug = request.session.get("activeorg")

        if organization_slug is not None:
            if is_active_superuser(request):
                try:
                    active_organization = Organization.objects.get_from_cache(
                        slug=organization_slug
                    )
                    if active_organization.status != OrganizationStatus.VISIBLE:
                        raise Organization.DoesNotExist
                except Organization.DoesNotExist:
                    logger.info("Active organization [%s] not found", organization_slug)

        if active_organization is None:
            organizations = Organization.objects.get_for_user(user=request.user)

        if active_organization is None and organization_slug:
            try:
                active_organization = next(o for o in organizations if o.slug == organization_slug)
            except StopIteration:
                logger.info("Active organization [%s] not found in scope", organization_slug)
                if is_implicit:
                    del request.session["activeorg"]
                active_organization = None

        if active_organization is None:
            if not is_implicit:
                return None

            try:
                active_organization = organizations[0]
            except IndexError:
                logger.info("User is not a member of any organizations")

        if active_organization and self._is_org_member(request.user, active_organization):
            if active_organization.slug != request.session.get("activeorg"):
                request.session["activeorg"] = active_organization.slug

        self._active_org = (active_organization, request.user)

        return active_organization

    def _is_org_member(self, user, organization):
        return OrganizationMember.objects.filter(user=user, organization=organization).exists()

    def is_not_2fa_compliant(self, request, organization):
        return (
            organization.flags.require_2fa
            and not Authenticator.objects.user_has_2fa(request.user)
            and not is_active_superuser(request)
        )

    def get_active_team(self, request, organization, team_slug):
        """
        Returns the currently selected team for the request or None
        if no match.
        """
        try:
            team = Team.objects.get_from_cache(slug=team_slug, organization=organization)
        except Team.DoesNotExist:
            return None

        if team.status != TeamStatus.VISIBLE:
            return None

        return team

    def get_active_project(self, request, organization, project_slug):
        try:
            project = Project.objects.get(slug=project_slug, organization=organization)
        except Project.DoesNotExist:
            return None

        if project.status != ProjectStatus.VISIBLE:
            return None

        return project

    def redirect_to_org(self, request):
        from sentry import features

        # TODO(dcramer): deal with case when the user cannot create orgs
        organization = self.get_active_organization(request)

        if organization:
            url = organization.get_url()
        elif not features.has("organizations:create"):
            return self.respond("sentry/no-organization-access.html", status=403)
        else:
            url = "/organizations/new/"
        return HttpResponseRedirect(url)


class BaseView(View, OrganizationMixin):
    auth_required = True
    # TODO(dcramer): change sudo so it can be required only on POST
    sudo_required = False

    csrf_protect = True

    def __init__(self, auth_required=None, sudo_required=None, csrf_protect=None, *args, **kwargs):
        if auth_required is not None:
            self.auth_required = auth_required
        if sudo_required is not None:
            self.sudo_required = sudo_required
        if csrf_protect is not None:
            self.csrf_protect = csrf_protect
        super().__init__(*args, **kwargs)

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        """
        A note on the CSRF protection process.

        Because the CSRF decorators don't work well with view subclasses, we
        allow them to control whether a CSRF check is done by setting
        self.csrf_protect. This has a couple of implications:

        1. We need to mark this method as @csrf_exempt so that when the CSRF
           middleware checks it as part of the regular middleware sequence, it
           always passes.
        2. If self.csrf_protect is set, we will re-run the CSRF check ourselves
           using CsrfViewMiddleware().process_view()
        3. But first we must remove the csrf_exempt attribute that was set by
           the decorator so that the middleware doesn't shortcut and pass the
           check unconditionally again.

        """
        if self.csrf_protect:
            if hasattr(self.dispatch.__func__, "csrf_exempt"):
                delattr(self.dispatch.__func__, "csrf_exempt")
            response = self.test_csrf(request)
            if response:
                return response

        if self.is_auth_required(request, *args, **kwargs):
            return self.handle_auth_required(request, *args, **kwargs)

        if self.is_sudo_required(request, *args, **kwargs):
            return self.handle_sudo_required(request, *args, **kwargs)

        args, kwargs = self.convert_args(request, *args, **kwargs)

        request.access = self.get_access(request, *args, **kwargs)

        if not self.has_permission(request, *args, **kwargs):
            return self.handle_permission_required(request, *args, **kwargs)

        if "organization" in kwargs and self.is_not_2fa_compliant(request, kwargs["organization"]):
            return self.handle_not_2fa_compliant(request, *args, **kwargs)

        self.request = request
        self.default_context = self.get_context_data(request, *args, **kwargs)

        return self.handle(request, *args, **kwargs)

    def test_csrf(self, request):
        middleware = CsrfViewMiddleware()
        return middleware.process_view(request, self.dispatch, [request], {})

    def get_access(self, request, *args, **kwargs):
        return access.DEFAULT

    def convert_args(self, request, *args, **kwargs):
        return (args, kwargs)

    def handle(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def is_auth_required(self, request, *args, **kwargs):
        return self.auth_required and not (
            request.user.is_authenticated() and request.user.is_active
        )

    def handle_auth_required(self, request, *args, **kwargs):
        auth.initiate_login(request, next_url=request.get_full_path())
        if "organization_slug" in kwargs:
            redirect_to = reverse("sentry-auth-organization", args=[kwargs["organization_slug"]])
        else:
            redirect_to = auth.get_login_url()
        return self.redirect(redirect_to, headers={"X-Robots-Tag": "noindex, nofollow"})

    def is_sudo_required(self, request, *args, **kwargs):
        return self.sudo_required and not request.is_sudo()

    def handle_sudo_required(self, request, *args, **kwargs):
        return redirect_to_sudo(request.get_full_path())

    def has_permission(self, request, *args, **kwargs):
        return True

    def handle_permission_required(self, request, *args, **kwargs):
        redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def handle_not_2fa_compliant(self, request, *args, **kwargs):
        redirect_uri = self.get_not_2fa_compliant_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def get_no_permission_url(request, *args, **kwargs):
        return reverse("sentry-login")

    def get_not_2fa_compliant_url(self, request, *args, **kwargs):
        return reverse("sentry-account-settings-security")

    def get_context_data(self, request, **kwargs):
        context = csrf(request)
        return context

    def respond(self, template, context=None, status=200):
        default_context = self.default_context
        if context:
            default_context.update(context)

        return render_to_response(template, default_context, self.request, status=status)

    def redirect(self, url, headers=None):
        res = HttpResponseRedirect(url)
        if headers:
            for k, v in headers.items():
                res[k] = v
        return res

    def get_team_list(self, user, organization):
        return Team.objects.get_for_user(organization=organization, user=user, with_projects=True)

    def create_audit_entry(self, request, transaction_id=None, **kwargs):
        return create_audit_entry(request, transaction_id, audit_logger, **kwargs)


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
        context = super().get_context_data(request)
        context["organization"] = organization
        context["TEAM_LIST"] = self.get_team_list(request.user, organization)
        context["ACCESS"] = request.access.to_django_context()
        return context

    def has_permission(self, request, organization, *args, **kwargs):
        if organization is None:
            return False
        if self.valid_sso_required:
            if request.access.requires_sso and not request.access.sso_is_valid:
                return False
            if self.needs_sso(request, organization):
                return False
        if self.required_scope and not request.access.has_scope(self.required_scope):
            logger.info(
                "User %s does not have %s permission to access organization %s",
                request.user,
                self.required_scope,
                organization,
            )
            return False
        return True

    def is_auth_required(self, request, organization_slug=None, *args, **kwargs):
        result = super().is_auth_required(request, *args, **kwargs)
        if result:
            return result

        # if the user is attempting to access an organization that *may* be
        # accessible if they simply re-authenticate, we want to allow that
        # this opens up a privacy hole, but the pros outweigh the cons
        if not organization_slug:
            return False

        active_organization = self.get_active_organization(
            request=request, organization_slug=organization_slug
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
        if self.needs_sso(request, organization):
            logger.info(
                "access.must-sso",
                extra={"organization_id": organization.id, "user_id": request.user.id},
            )
            auth.initiate_login(request, next_url=request.get_full_path())
            redirect_uri = reverse("sentry-auth-organization", args=[organization.slug])
        else:
            redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def needs_sso(self, request, organization):
        if not organization:
            return False
        # XXX(dcramer): this branch should really never hit
        if not request.user.is_authenticated():
            return False
        if not self.valid_sso_required:
            return False
        if not request.access.requires_sso:
            return False
        if not auth.has_completed_sso(request, organization.id):
            return True
        if not request.access.sso_is_valid:
            return True
        return False

    def convert_args(self, request, organization_slug=None, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request, organization_slug=organization_slug
        )

        kwargs["organization"] = active_organization

        return (args, kwargs)

    def get_allowed_roles(self, request, organization, member=None):
        can_admin = request.access.has_scope("member:admin")

        allowed_roles = []
        if can_admin and not is_active_superuser(request):
            acting_member = OrganizationMember.objects.get(
                user=request.user, organization=organization
            )
            if member and roles.get(acting_member.role).priority < roles.get(member.role).priority:
                can_admin = False
            else:
                allowed_roles = [
                    r
                    for r in roles.get_all()
                    if r.priority <= roles.get(acting_member.role).priority
                ]
                can_admin = bool(allowed_roles)
        elif is_active_superuser(request):
            allowed_roles = roles.get_all()
        return (can_admin, allowed_roles)


class TeamView(OrganizationView):
    """
    Any view acting on behalf of a team should inherit from this base and the
    matching URL pattern must pass 'team_slug'.

    Two keyword arguments are added to the resulting dispatch:

    - organization
    - team
    """

    def get_context_data(self, request, organization, team, **kwargs):
        context = super().get_context_data(request, organization)
        context["team"] = team
        return context

    def has_permission(self, request, organization, team, *args, **kwargs):
        if team is None:
            return False
        rv = super().has_permission(request, organization)
        if not rv:
            return rv
        if self.required_scope:
            if not request.access.has_team_scope(team, self.required_scope):
                logger.info(
                    "User %s does not have %s permission to access team %s",
                    request.user,
                    self.required_scope,
                    team,
                )
                return False
        elif not request.access.has_team(team):
            logger.info("User %s does not have access to team %s", request.user, team)
            return False
        return True

    def convert_args(self, request, organization_slug, team_slug, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request, organization_slug=organization_slug
        )

        if active_organization:
            active_team = self.get_active_team(
                request=request, team_slug=team_slug, organization=active_organization
            )
        else:
            active_team = None

        kwargs["organization"] = active_organization
        kwargs["team"] = active_team

        return (args, kwargs)


class ProjectView(OrganizationView):
    """
    Any view acting on behalf of a project should inherit from this base and the
    matching URL pattern must pass 'org_slug' as well as 'project_slug'.

    Three keyword arguments are added to the resulting dispatch:

    - organization
    - project
    """

    def get_context_data(self, request, organization, project, **kwargs):
        context = super().get_context_data(request, organization)
        context["project"] = project
        context["processing_issues"] = serialize(project).get("processingIssues", 0)
        return context

    def has_permission(self, request, organization, project, *args, **kwargs):
        if project is None:
            return False
        rv = super().has_permission(request, organization)
        if not rv:
            return rv

        teams = list(project.teams.all())

        if self.required_scope:
            if not any(request.access.has_team_scope(team, self.required_scope) for team in teams):
                logger.info(
                    "User %s does not have %s permission to access project %s",
                    request.user,
                    self.required_scope,
                    project,
                )
                return False
        elif not any(request.access.has_team(team) for team in teams):
            logger.info("User %s does not have access to project %s", request.user, project)
            return False
        return True

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        active_organization = self.get_active_organization(
            request=request, organization_slug=organization_slug
        )

        if active_organization:
            active_project = self.get_active_project(
                request=request, organization=active_organization, project_slug=project_slug
            )
        else:
            active_project = None

        kwargs["project"] = active_project
        kwargs["organization"] = active_organization

        return (args, kwargs)


class AvatarPhotoView(View):
    model = None

    def get(self, request, *args, **kwargs):
        avatar_id = kwargs["avatar_id"]
        try:
            avatar = self.model.objects.get(ident=avatar_id)
        except self.model.DoesNotExist:
            return HttpResponseNotFound()

        photo = avatar.file
        if not photo:
            return HttpResponseNotFound()

        size = request.GET.get("s")
        photo_file = photo.getfile()
        if size:
            try:
                size = int(size)
            except ValueError:
                return HttpResponseBadRequest()
            else:
                photo_file = avatar.get_cached_photo(size)

        res = HttpResponse(photo_file, content_type="image/png")
        res["Cache-Control"] = FOREVER_CACHE
        return res
