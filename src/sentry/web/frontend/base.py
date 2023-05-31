from __future__ import annotations

import abc
import inspect
import logging
from typing import Any, Mapping, Protocol

from django.http import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseNotFound,
    HttpResponseRedirect,
)
from django.middleware.csrf import CsrfViewMiddleware
from django.template.context_processors import csrf
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.utils import generate_organization_url, is_member_disabled_from_limit
from sentry.auth import access
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ObjectStatus
from sentry.models import Organization, OrganizationStatus, Project, Team, TeamStatus
from sentry.models.avatars.base import AvatarBase
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationSummary,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.utils import auth
from sentry.utils.audit import create_audit_entry
from sentry.utils.auth import is_valid_redirect, make_login_link_with_redirect
from sentry.utils.http import absolute_uri, is_using_customer_domain
from sentry.web.frontend.generic import FOREVER_CACHE
from sentry.web.helpers import render_to_response
from sudo.views import redirect_to_sudo

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("sentry.audit.ui")


class _HasRespond(Protocol):
    active_organization: RpcUserOrganizationContext | None

    def respond(
        self, template: str, context: dict[str, Any] | None = None, status: int = 200
    ) -> HttpResponse:
        ...


class OrganizationMixin:
    # This attribute will only be set once determine_active_organization is called.  Subclasses should likely invoke
    # that method, passing along the organization_slug context that might exist (or might not).
    active_organization: RpcUserOrganizationContext | None

    # TODO(dcramer): move the implicit organization logic into its own class
    # as it's only used in a single location and over complicates the rest of
    # the code
    def determine_active_organization(
        self, request: Request, organization_slug: str | None = None
    ) -> None:
        """
        Using the current request and potentially optional organization_slug, 'determines'
        the current session for this mixin object's scope, placing it into the active_organization attribute.

        Generally this method only need be called once at the head of a request, as it can potentially have side
        effects in the user's session.  That said, when login occurs during a request, this method should be called
        be called again to refresh an active organization context.
        """

        if organization_slug is None:
            is_implicit = True
            organization_slug = self._find_implicit_slug(request)
        else:
            is_implicit = False

        active_organization, backup_organization = self._lookup_organizations(
            is_implicit, organization_slug, request
        )

        if active_organization is None and backup_organization:
            if not is_implicit:
                self.active_organization = None
                return
            active_organization = organization_service.get_organization_by_id(
                id=backup_organization.id, user_id=request.user.id
            )

        if active_organization and active_organization.member:
            auth.set_active_org(request, active_organization.organization.slug)

        self.active_organization = active_organization

    def _lookup_organizations(
        self, is_implicit: bool, organization_slug: str | None, request: Request
    ) -> tuple[RpcUserOrganizationContext | None, RpcOrganizationSummary | None]:
        active_organization: RpcUserOrganizationContext | None = self._try_superuser_org_lookup(
            organization_slug, request
        )
        backup_organization: RpcOrganizationSummary | None = None
        if active_organization is None:
            organizations = organization_service.get_organizations(
                user_id=request.user.id, scope=None, only_visible=True
            )

            if organizations:
                backup_organization = organizations[0]
                if organization_slug:
                    active_organization = self._try_finding_org_from_slug(
                        is_implicit, organization_slug, organizations, request
                    )
        return active_organization, backup_organization

    def _try_finding_org_from_slug(
        self,
        is_implicit: bool,
        organization_slug: str,
        organizations: list[RpcOrganizationSummary],
        request: Request,
    ) -> RpcUserOrganizationContext | None:
        try:
            backup_org: RpcOrganizationSummary | None = next(
                o for o in organizations if o.slug == organization_slug
            )
        except StopIteration:
            logger.info("Active organization [%s] not found in scope", organization_slug)
            if is_implicit:
                session = request.session
                if session and "activeorg" in session:
                    del session["activeorg"]
            backup_org = None

        if backup_org is not None:
            return organization_service.get_organization_by_id(
                id=backup_org.id, user_id=request.user.id
            )
        return None

    def _try_superuser_org_lookup(
        self, organization_slug: str | None, request: Request
    ) -> RpcUserOrganizationContext | None:
        active_organization: RpcUserOrganizationContext | None = None
        if organization_slug is not None:
            if is_active_superuser(request):
                active_organization = organization_service.get_organization_by_slug(
                    user_id=request.user.id, slug=organization_slug, only_visible=True
                )
        return active_organization

    def _find_implicit_slug(self, request: Request) -> str | None:
        organization_slug = request.session.get("activeorg")
        if request.subdomain is not None and request.subdomain != organization_slug:
            # Customer domain is being used, set the subdomain as the requesting org slug.
            organization_slug = request.subdomain
        return organization_slug  # type: ignore[no-any-return]

    def is_not_2fa_compliant(
        self, request: Request, organization: RpcOrganization | Organization
    ) -> bool:
        return (
            organization.flags.require_2fa
            and not request.user.has_2fa()
            and not is_active_superuser(request)
        )

    def is_member_disabled_from_limit(
        self, request: Request, organization: RpcUserOrganizationContext | RpcOrganization
    ) -> bool:
        return is_member_disabled_from_limit(request, organization)

    def get_active_team(
        self, request: Request, organization: RpcOrganization, team_slug: str
    ) -> Team | None:
        """
        Returns the currently selected team for the request or None
        if no match.
        """
        try:
            team = Team.objects.get_from_cache(slug=team_slug, organization=organization)
        except Team.DoesNotExist:
            return None

        if team.status != TeamStatus.ACTIVE:
            return None

        return team

    def get_active_project(
        self, request: Request, organization: RpcOrganization, project_slug: str
    ) -> Project | None:
        try:
            project = Project.objects.get(slug=project_slug, organization=organization)
        except Project.DoesNotExist:
            return None

        if project.status != ObjectStatus.ACTIVE:
            return None

        return project

    def redirect_to_org(self: _HasRespond, request: Request) -> HttpResponse:
        from sentry import features

        using_customer_domain = request and is_using_customer_domain(request)

        # TODO(dcramer): deal with case when the user cannot create orgs
        if self.active_organization:
            current_org_slug = self.active_organization.organization.slug
            url = Organization.get_url(current_org_slug)
            if using_customer_domain:
                url_prefix = generate_organization_url(request.subdomain)
                url = absolute_uri(url, url_prefix=url_prefix)
        elif not features.has("organizations:create"):
            return self.respond("sentry/no-organization-access.html", status=403)
        else:
            url = reverse("sentry-organization-create")
            if using_customer_domain:
                url = absolute_uri(url)

            if using_customer_domain and request.user and request.user.is_authenticated:
                requesting_org_slug = request.subdomain
                org_context = organization_service.get_organization_by_slug(
                    slug=requesting_org_slug, only_visible=False, user_id=request.user.id
                )
                if org_context and org_context.organization:
                    if org_context.organization.status == OrganizationStatus.PENDING_DELETION:
                        url = reverse("sentry-customer-domain-restore-organization")
                    elif org_context.organization.status == OrganizationStatus.DELETION_IN_PROGRESS:
                        url_prefix = options.get("system.url-prefix")
                        url = reverse("sentry-organization-create")
                        return HttpResponseRedirect(absolute_uri(url, url_prefix=url_prefix))
                    else:
                        # If the user is a superuser, redirect them to the org's landing page (e.g. issues page)
                        if request.user.is_superuser:
                            url = Organization.get_url(requesting_org_slug)
                        else:
                            url = reverse("sentry-auth-organization", args=[requesting_org_slug])
                    url_prefix = generate_organization_url(requesting_org_slug)
                    url = absolute_uri(url, url_prefix=url_prefix)

        return HttpResponseRedirect(url)


class BaseView(View, OrganizationMixin):  # type: ignore[misc]
    auth_required = True
    # TODO(dcramer): change sudo so it can be required only on POST
    sudo_required = False

    csrf_protect = True

    def __init__(
        self,
        auth_required: bool | None = None,
        sudo_required: bool | None = None,
        csrf_protect: bool | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        if auth_required is not None:
            self.auth_required = auth_required
        if sudo_required is not None:
            self.sudo_required = sudo_required
        if csrf_protect is not None:
            self.csrf_protect = csrf_protect
        super().__init__(*args, **kwargs)

    @csrf_exempt  # type: ignore[misc]
    def dispatch(self, request: Request, *args: Any, **kwargs: Any) -> Response:
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

        organization_slug = kwargs.get("organization_slug", None)
        if request and is_using_customer_domain(request):
            organization_slug = request.subdomain
        self.determine_active_organization(request, organization_slug)

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

        if (
            is_using_customer_domain(request)
            and "organization_slug" in inspect.signature(self.convert_args).parameters
            and "organization_slug" not in kwargs
        ):
            # In customer domain contexts, we will need to pre-populate the organization_slug keyword argument.
            kwargs["organization_slug"] = organization_slug

        args, kwargs = self.convert_args(request, *args, **kwargs)

        request.access = self.get_access(request, *args, **kwargs)

        if not self.has_permission(request, *args, **kwargs):
            return self.handle_permission_required(request, *args, **kwargs)

        if "organization" in kwargs:
            org = kwargs["organization"]
            if self.is_member_disabled_from_limit(request, org):
                return self.handle_disabled_member(org)
            if self.is_not_2fa_compliant(request, org):
                return self.handle_not_2fa_compliant(request, *args, **kwargs)

        self.request = request
        self.default_context = self.get_context_data(request, *args, **kwargs)

        return self.handle(request, *args, **kwargs)

    def test_csrf(self, request: Request) -> HttpResponse:
        middleware = CsrfViewMiddleware()
        return middleware.process_view(request, self.dispatch, [request], {})

    def get_access(self, request: Request, *args: Any, **kwargs: Any) -> access.Access:
        return access.DEFAULT

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        return (args, kwargs)

    def handle(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def is_auth_required(self, request: Request, *args: Any, **kwargs: Any) -> bool:
        return self.auth_required and not (request.user.is_authenticated and request.user.is_active)

    def handle_auth_required(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        auth.initiate_login(request, next_url=request.get_full_path())
        if "organization_slug" in kwargs:
            redirect_to = reverse("sentry-auth-organization", args=[kwargs["organization_slug"]])
        else:
            redirect_to = auth.get_login_url()
        return self.redirect(redirect_to, headers={"X-Robots-Tag": "noindex, nofollow"})

    def is_sudo_required(self, request: Request, *args: Any, **kwargs: Any) -> bool:
        return self.sudo_required and not request.is_sudo()

    def handle_sudo_required(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        return redirect_to_sudo(request.get_full_path())

    def has_permission(self, request: Request, *args: Any, **kwargs: Any) -> bool:
        return True

    def handle_permission_required(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> HttpResponse:
        redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def handle_not_2fa_compliant(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        redirect_uri = self.get_not_2fa_compliant_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def get_no_permission_url(self, request: Request, *args: Any, **kwargs: Any) -> str:
        return reverse("sentry-login")  # type: ignore[no-any-return]

    def get_not_2fa_compliant_url(self, request: Request, *args: Any, **kwargs: Any) -> str:
        return reverse("sentry-account-settings-security")  # type: ignore[no-any-return]

    def get_context_data(self, request: Request, **kwargs: Any) -> dict[str, Any]:
        context = csrf(request)
        return context  # type: ignore[no-any-return]

    def respond(
        self, template: str, context: dict[str, Any] | None = None, status: int = 200
    ) -> HttpResponse:
        default_context = self.default_context
        if context:
            default_context.update(context)

        return render_to_response(template, default_context, self.request, status=status)

    def redirect(self, url: str, headers: Mapping[str, str] | None = None) -> HttpResponse:
        res = HttpResponseRedirect(url)
        if headers:
            for k, v in headers.items():
                res[k] = v
        return res

    def get_team_list(self, user: User, organization: Organization) -> list[Team]:
        return Team.objects.get_for_user(organization=organization, user=user, with_projects=True)  # type: ignore[no-any-return]

    def create_audit_entry(
        self, request: Request, transaction_id: int | None = None, **kwargs: Any
    ) -> object:
        return create_audit_entry(request, transaction_id, audit_logger, **kwargs)

    def handle_disabled_member(self, organization: Organization) -> HttpResponse:
        redirect_uri = reverse("sentry-organization-disabled-member", args=[organization.slug])
        return self.redirect(redirect_uri)


class AbstractOrganizationView(BaseView, abc.ABC):
    """
    The 'organization' keyword argument is automatically injected into the resulting dispatch, but currently the
    typing of 'organization' will vary based on the subclass.  It may either be an RpcOrganization or an orm
    Organization based on the subclass.  Be mindful during this transition of the typing.
    """

    required_scope: str | None = None
    valid_sso_required = True

    def get_access(self, request: Request, *args: Any, **kwargs: Any) -> access.Access:
        if self.active_organization is None:
            return access.DEFAULT
        return access.from_request_org_and_scopes(
            request=request, rpc_user_org_context=self.active_organization
        )

    def get_context_data(self, request: Request, organization: RpcOrganization | Organization, **kwargs: Any) -> dict[str, Any]:  # type: ignore[override]
        context = super().get_context_data(request)
        context["organization"] = organization
        return context

    def has_permission(self, request: Request, organization: RpcOrganization | Organization, *args: Any, **kwargs: Any) -> bool:  # type: ignore[override]
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

    def is_auth_required(
        self, request: Request, organization_slug: str | None = None, *args: Any, **kwargs: Any
    ) -> bool:
        result = super().is_auth_required(request, *args, **kwargs)
        if result:
            return result

        if organization_slug is None and request.subdomain:
            organization_slug = request.subdomain

        # if the user is attempting to access an organization that *may* be
        # accessible if they simply re-authenticate, we want to allow that
        # this opens up a privacy hole, but the pros outweigh the cons
        if not organization_slug:
            return False

        if not self.active_organization:
            # Require auth if we there is an organization associated with the slug that we just cannot access
            # for some reason.
            return (
                organization_service.get_organization_by_slug(
                    user_id=None, slug=organization_slug, only_visible=True
                )
                is not None
            )

        return False

    def handle_permission_required(self, request: Request, organization: Organization | RpcOrganization | None, *args: Any, **kwargs: Any) -> HttpResponse:  # type: ignore[override]
        if organization and self.needs_sso(request, organization):
            logger.info(
                "access.must-sso",
                extra={"organization_id": organization.id, "user_id": request.user.id},
            )
            auth.initiate_login(request)
            path = reverse("sentry-auth-organization", args=[organization.slug])

            request_path = request.get_full_path()

            after_login_redirect = (
                request_path
                if is_valid_redirect(request_path, allowed_hosts=(request.get_host(),))
                else None
            )
            redirect_uri = make_login_link_with_redirect(path, after_login_redirect)

        else:
            if is_using_customer_domain(request):
                # In the customer domain world, if an organziation is pending deletion, we redirect the user to the
                # organization restoration page.
                org_context = organization_service.get_organization_by_slug(
                    slug=request.subdomain, only_visible=False, user_id=request.user.id
                )
                if org_context and org_context.member:
                    if org_context.organization.status == OrganizationStatus.PENDING_DELETION:
                        url_base = generate_organization_url(org_context.organization.slug)
                        restore_org_path = reverse("sentry-customer-domain-restore-organization")
                        return self.redirect(f"{url_base}{restore_org_path}")
                    elif org_context.organization.status == OrganizationStatus.DELETION_IN_PROGRESS:
                        url_base = options.get("system.url-prefix")
                        create_org_path = reverse("sentry-organization-create")
                        return self.redirect(f"{url_base}{create_org_path}")
            redirect_uri = self.get_no_permission_url(request, *args, **kwargs)
        return self.redirect(redirect_uri)

    def needs_sso(self, request: Request, organization: Organization | RpcOrganization) -> bool:
        if not organization:
            return False
        # XXX(dcramer): this branch should really never hit
        if not request.user.is_authenticated:
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

    @abc.abstractmethod
    def _get_organization(self) -> Organization | RpcOrganization | None:
        raise NotImplementedError

    def convert_args(
        self, request: Request, organization_slug: str | None = None, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        if "organization" not in kwargs:
            kwargs["organization"] = self._get_organization()

        return super().convert_args(request, *args, **kwargs)


class OrganizationView(AbstractOrganizationView):
    """
    A view which has direct ORM access to organization objects.  Only endpoints that exist in the
    region silo should use this class.
    """

    def _get_organization(self) -> Organization | None:
        if not self.active_organization:
            return None
        try:
            return Organization.objects.get(id=self.active_organization.organization.id)
        except Organization.DoesNotExist:
            return None


class ControlSiloOrganizationView(AbstractOrganizationView):
    """A view which accesses organization objects over RPC.

    Only endpoints on the control silo should use this class (but it works anywhere).
    """

    def _get_organization(self) -> RpcOrganization | None:
        return self.active_organization.organization if self.active_organization else None


class ProjectView(OrganizationView):
    """
    Any view acting on behalf of a project should inherit from this base and the
    matching URL pattern must pass 'org_slug' as well as 'project_slug'.

    Three keyword arguments are added to the resulting dispatch:

    - organization
    - project
    """

    def get_context_data(self, request: Request, organization: Organization, project: Project, **kwargs: Any) -> dict[str, Any]:  # type: ignore[override]
        from sentry.api.serializers import serialize

        context = super().get_context_data(request, organization)
        context["project"] = project
        context["processing_issues"] = serialize(project).get("processingIssues", 0)
        return context

    def has_permission(self, request: Request, organization: Organization, project: Project, *args: Any, **kwargs: Any) -> bool:  # type: ignore[override]
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
        elif not any(request.access.has_team_access(team) for team in teams):
            logger.info("User %s does not have access to project %s", request.user, project)
            return False
        return True

    def convert_args(self, request: Request, organization_slug: str, project_slug: str, *args: Any, **kwargs: Any) -> tuple[tuple[Any, ...], dict[str, Any]]:  # type: ignore[override]
        organization: Organization | None = None
        active_project: Project | None = None
        if self.active_organization:
            organization = self._get_organization()

            if organization:
                active_project = self.get_active_project(
                    request=request, organization=organization, project_slug=project_slug
                )

        kwargs["project"] = active_project
        kwargs["organization"] = organization

        return args, kwargs


class AvatarPhotoView(View):  # type: ignore[misc]
    model: type[AvatarBase]

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        avatar_id = kwargs["avatar_id"]
        try:
            avatar = self.model.objects.get(ident=avatar_id)
        except self.model.DoesNotExist:
            return HttpResponseNotFound()

        photo = avatar.get_file()
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
