import ast

filename = "src/sentry/api/permissions.py"

head = """from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from rest_framework import permissions
from rest_framework.request import Request

from sentry import features
from sentry.api.exceptions import (
    DataSecrecyError,
    MemberDisabledOverLimit,
    SsoRequired,
    SuperuserRequired,
    TwoFactorRequired,
)
from sentry.auth import access
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.services.hybrid_cloud import extract_id_from
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.utils import auth

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class RelayPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return getattr(request, "relay", None) is not None


class SystemPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return is_system_auth(request.auth)


class NoPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return False


class ScopedPermission(permissions.BasePermission):
    \"\"\"
    Permissions work depending on the type of authentication:

    - A user inherits permissions based on their membership role. These are
      still dictated as common scopes, but they can't be checked until the
      has_object_permission hook is called.
    - ProjectKeys (legacy) are granted only project based scopes. This
    - APIKeys specify their scope, and work as expected.
    \"\"\"

    scope_map: dict[str, Sequence[str]] = {
        "HEAD": (),
        "GET": (),
        "POST": (),
        "PUT": (),
        "PATCH": (),
        "DELETE": (),
    }

    def has_permission(self, request: Request, view: object) -> bool:
        # session-based auth has all scopes for a logged in user
        if not getattr(request, "auth", None):
            return request.user.is_authenticated

        allowed_scopes: set[str] = set(self.scope_map.get(request.method, []))
        current_scopes = request.auth.get_scopes()
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request: Request, view: object, obj: Any) -> bool:
        return False


class SuperuserPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        if is_active_superuser(request):
            return True
        if request.user.is_authenticated and request.user.is_superuser:
            raise SuperuserRequired
        return False


class SentryPermission(ScopedPermission):
    def is_not_2fa_compliant(
        self, request: Request, organization: RpcOrganization | Organization
    ) -> bool:
        return False

    def needs_sso(self, request: Request, organization: Organization | RpcOrganization) -> bool:
        return False

    def is_member_disabled_from_limit(
        self,
        request: Request,
        organization: RpcUserOrganizationContext | RpcOrganization | Organization,
    ) -> bool:
        return False

    # This wide typing on organization gives us a lot of flexibility as we move forward with hybrid cloud.
    # Once we have fully encircled all call sites (which are MANY!) we can collapse the typing around a single
    # usage (likely the RpcUserOrganizationContext, which is necessary for access and organization details).
    # For now, this wide typing allows incremental rollout of those changes.  Be mindful how you use
    # organization in this method to stay compatible with all 3 paths.
    def determine_access(
        self,
        request: Request,
        organization: RpcUserOrganizationContext | Organization | RpcOrganization,
    ) -> None:
        from sentry.api.base import logger

        org_context: RpcUserOrganizationContext | None
        if isinstance(organization, RpcUserOrganizationContext):
            org_context = organization
        else:
            org_context = organization_service.get_organization_by_id(
                id=extract_id_from(organization), user_id=request.user.id if request.user else None
            )

        if org_context is None:
            assert False, "Failed to fetch organization in determine_access"

        organization = org_context.organization
        if (
            request.user
            and request.user.is_superuser
            and features.has("organizations:enterprise-data-secrecy", org_context.organization)
        ):
            raise DataSecrecyError()

        if request.auth and request.user and request.user.is_authenticated:
            request.access = access.from_request_org_and_scopes(
                request=request,
                rpc_user_org_context=org_context,
                scopes=request.auth.get_scopes(),
            )
            return

        if request.auth:
            request.access = access.from_rpc_auth(
                auth=request.auth, rpc_user_org_context=org_context
            )
            return

        request.access = access.from_request_org_and_scopes(
            request=request,
            rpc_user_org_context=org_context,
        )

        extra = {"organization_id": org_context.organization.id, "user_id": request.user.id}

        if auth.is_user_signed_request(request):
            # if the user comes from a signed request
            # we let them pass if sso is enabled
            logger.info(
                "access.signed-sso-passthrough",
                extra=extra,
            )
        elif request.user.is_authenticated:
            # session auth needs to confirm various permissions
            if self.needs_sso(request, org_context.organization):

                logger.info(
                    "access.must-sso",
                    extra=extra,
                )

                after_login_redirect = request.META.get("HTTP_REFERER", "")
                if not auth.is_valid_redirect(
                    after_login_redirect, allowed_hosts=(request.get_host(),)
                ):
                    after_login_redirect = None

                raise SsoRequired(
                    organization=organization, after_login_redirect=after_login_redirect
                )

            if self.is_not_2fa_compliant(request, org_context.organization):
                logger.info(
                    "access.not-2fa-compliant",
                    extra=extra,
                )
                if request.user.is_superuser and extract_id_from(organization) != Superuser.org_id:
                    raise SuperuserRequired()

                raise TwoFactorRequired()

            if self.is_member_disabled_from_limit(request, org_context):
                logger.info(
                    "access.member-disabled-from-limit",
                    extra=extra,
                )
                raise MemberDisabledOverLimit(organization)
"""

change = """from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from rest_framework import permissions
from rest_framework.request import Request

from sentry import features
from sentry.api.exceptions import (
    DataSecrecyError,
    MemberDisabledOverLimit,
    SsoRequired,
    SuperuserRequired,
    TwoFactorRequired,
)
from sentry.auth import access
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.services.hybrid_cloud import extract_id_from
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.utils import auth

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class RelayPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return getattr(request, "relay", None) is not None

    def hello_there(self) -> str:
        return "henlo"


class SystemPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return False


class NoPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return False


class ScopedPermission(permissions.BasePermission):
    \"\"\"
    Permissions work depending on the type of authentication:

    - A user inherits permissions based on their membership role. These are
      still dictated as common scopes, but they can't be checked until the
      has_object_permission hook is called.
    - ProjectKeys (legacy) are granted only project based scopes. This
    - APIKeys specify their scope, and work as expected.
    \"\"\"

    scope_map: dict[str, Sequence[str]] = {
        "HEAD": (),
        "GET": (),
        "POST": (),
        "PUT": (),
        "PATCH": (),
        "DELETE": (),
    }

    def has_permission(self, request: Request, view: object) -> bool:
        # session-based auth has all scopes for a logged in user
        if not getattr(request, "auth", None):
            return request.user.is_authenticated

        allowed_scopes: set[str] = set(self.scope_map.get(request.method, []))
        current_scopes = request.auth.get_scopes()
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request: Request, view: object, obj: Any) -> bool:
        return False


class SuperuserPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        if is_active_superuser(request):
            return True
        elif request.user.is_authenticated and request.user.is_superuser:
            raise SuperuserRequired
        return False


class SentryPermission(ScopedPermission):
    def is_not_2fa_compliant(
        self, request: Request, organization: RpcOrganization | Organization
    ) -> bool:
        return False

    def needs_sso(self, request: Request, organization: Organization | RpcOrganization) -> bool:
        return False

    def is_member_disabled_from_limit(
        self,
        request: Request,
        organization: RpcUserOrganizationContext | RpcOrganization | Organization,
    ) -> bool:
        return False

    # This wide typing on organization gives us a lot of flexibility as we move forward with hybrid cloud.
    # Once we have fully encircled all call sites (which are MANY!) we can collapse the typing around a single
    # usage (likely the RpcUserOrganizationContext, which is necessary for access and organization details).
    # For now, this wide typing allows incremental rollout of those changes.  Be mindful how you use
    # organization in this method to stay compatible with all 3 paths.
    def determine_access(
        self,
        request: Request,
        organization: RpcUserOrganizationContext | Organization | RpcOrganization,
    ) -> None:
        from sentry.api.base import logger

        org_context: RpcUserOrganizationContext | None
        if isinstance(organization, RpcUserOrganizationContext):
            org_context = organization
        else:
            org_context = organization_service.get_organization_by_id(
                id=extract_id_from(organization), user_id=request.user.id if request.user else None
            )

        if org_context is None:
            assert False, "Failed to fetch organization in determine_access"

        organization = org_context.organization
        if (
            request.user
            and request.user.is_superuser
            and features.has("organizations:enterprise-data-secrecy", org_context.organization)
        ):
            raise DataSecrecyError()

        if request.auth and request.user and request.user.is_authenticated:
            request.access = access.from_request_org_and_scopes(
                request=request,
                rpc_user_org_context=org_context,
                scopes=request.auth.get_scopes(),
            )
            return

        if request.auth:
            request.access = access.from_rpc_auth(
                auth=request.auth, rpc_user_org_context=org_context
            )
            return

        request.access = access.from_request_org_and_scopes(
            request=request,
            rpc_user_org_context=org_context,
        )

        extra = {"organization_id": org_context.organization.id, "user_id": request.user.id}

        if auth.is_user_signed_request(request):
            # if the user comes from a signed request
            # we let them pass if sso is enabled
            logger.info(
                "access.signed-sso-passthrough",
                extra=extra,
            )
        elif request.user.is_authenticated:
            # session auth needs to confirm various permissions
            if self.needs_sso(request, org_context.organization):

                logger.info(
                    "access.must-sso",
                    extra=extra,
                )

                after_login_redirect = request.META.get("HTTP_REFERER", "")
                if not auth.is_valid_redirect(
                    after_login_redirect, allowed_hosts=(request.get_host(),)
                ):
                    after_login_redirect = None

                raise SsoRequired(
                    organization=organization, after_login_redirect=after_login_redirect
                )

            if self.is_not_2fa_compliant(request, org_context.organization):
                logger.info(
                    "access.not-2fa-compliant",
                    extra=extra,
                )
                if request.user.is_superuser and extract_id_from(organization) != Superuser.org_id:
                    raise SuperuserRequired()

                raise TwoFactorRequired()

            if self.is_member_disabled_from_limit(request, org_context):
                logger.info(
                    "access.member-disabled-from-limit",
                    extra=extra,
                )
                raise MemberDisabledOverLimit(organization)
"""

# Reverse Code Mapping
# stack root, source root
print("# REVERSE CODE MAPPING")
code_mappings = [
    (".", "static"),
    ("app/", "static/app/"),
    ("sentry/", "/src/sentry/"),
    ("./", ""),
    ("sentry/", "src/sentry"),
    ("", "src/"),
    ("sentry/", "src/sentry/"),
    ("src/", "src/"),
]

possible_roots = set()
# assuming we don't support globbing
for mapping in code_mappings:
    # if filename starts with the source root
    if filename.startswith(mapping[1]):
        possible_roots.add(filename.replace(mapping[1], mapping[0], 1))
print("Filename:", filename)
print("Possible stack roots: ", possible_roots)
print()

# AST Only Implementation
print("# AST ONLY IMPLEMENTATION")

pr_head_ast = ast.parse(head)
# label parents in the tree
for node in ast.walk(pr_head_ast):
    for child in ast.iter_child_nodes(node):
        child.parent = node


# get routes from root to function definition nodes in PR head
class FunctionRouteVisitor(ast.NodeVisitor):
    def __init__(self):
        self.routes = {}
        self.current_route = []

    def visit_FunctionDef(self, node):
        self.current_route.append(node)
        self.routes[node] = self.current_route.copy()
        self.generic_visit(node)
        self.current_route.pop()

    def visit(self, node):
        self.current_route.append(node)
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.FunctionDef):
                self.visit_FunctionDef(child)
            else:
                self.visit(child)
        self.current_route.pop()


function_visitor = FunctionRouteVisitor()
function_visitor.visit(pr_head_ast)

# for function_node, route in function_visitor.routes.items():
#     print(
#         f"Function '{function_node}':",
#         [node.name if node.__class__.__name__ != "Module" else "Module" for node in route],
#     )


pr_change_ast = ast.parse(change)

# label parents in the tree
for node in ast.walk(pr_change_ast):
    for child in ast.iter_child_nodes(node):
        child.parent = node


# check if the routes are visitable in the changed AST
def visit_route(root, route):
    index = 0
    current_node = root
    while index + 1 < len(route):
        if isinstance(route[index], ast.FunctionDef) and ast.dump(route[index]) != ast.dump(
            current_node
        ):
            return False
        elif isinstance(route[index], ast.Module):
            pass
        elif current_node.__class__.__name__ != route[index].__class__.__name__:
            return False

        index += 1
        found_next_node = False
        for child in list(ast.iter_child_nodes(current_node)):
            if isinstance(route[index], ast.FunctionDef) and ast.dump(route[index]) == ast.dump(
                child
            ):
                current_node = child
                found_next_node = True
                break
            elif child.__class__.__name__ == route[index].__class__.__name__:
                if hasattr(child, "name") and hasattr(route[index], "name"):
                    if child.name == route[index].name:
                        current_node = child
                        found_next_node = True
                        break

        if not found_next_node:
            return False

    if isinstance(route[index], ast.FunctionDef) and ast.dump(route[index]) != ast.dump(
        current_node
    ):
        return False

    return True


functions_changed = list()

for function_node, route in function_visitor.routes.items():
    root = pr_change_ast
    if not visit_route(root, route):
        functions_changed.append(function_node)

# correct functions modified
# has_permission in SystemPermission
# has_permission in SuperuserPermission

for function_node in functions_changed:
    print(
        function_node.name,
        (function_node.lineno, function_node.end_lineno),
        function_node.parent.name,
    )
