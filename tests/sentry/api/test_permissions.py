from collections.abc import Generator

from django.test import SimpleTestCase
from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver
from rest_framework.views import APIView

from sentry.api.base import Endpoint
from sentry.api.permissions import (
    DemoSafePermission,
    DisallowImpersonatedTokenCreation,
    SentryIsAuthenticated,
    StaffPermission,
    SuperuserOrStaffFeatureFlaggedPermission,
    SuperuserPermission,
)
from sentry.conf.server import SENTRY_READONLY_SCOPES
from sentry.demo_mode.utils import READONLY_SCOPES
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test

MUTATION_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _iter_endpoint_view_classes(urlpatterns) -> Generator[type[Endpoint]]:
    for pattern in urlpatterns:
        if isinstance(pattern, URLResolver):
            yield from _iter_endpoint_view_classes(pattern.url_patterns)
        elif isinstance(pattern, URLPattern):
            callback = pattern.callback
            if hasattr(callback, "view_class") and issubclass(callback.view_class, Endpoint):
                yield callback.view_class


def _get_class_path(cls: type[object]) -> str:
    return f"{cls.__module__}.{cls.__name__}"


def _get_readonly_mutation_scope_exceptions(cls: type[object]) -> dict[str, str]:
    return getattr(cls, "readonly_mutation_scope_exceptions", {}) or {}


class PermissionsTest(DRFPermissionTestCase):
    superuser_permission = SuperuserPermission()
    staff_permission = StaffPermission()
    superuser_staff_flagged_permission = SuperuserOrStaffFeatureFlaggedPermission()

    def test_superuser_permission(self) -> None:
        assert self.superuser_permission.has_permission(self.superuser_request, APIView())

    def test_staff_permission(self) -> None:
        assert self.staff_permission.has_permission(self.staff_request, APIView())

    @override_options({"staff.ga-rollout": True})
    def test_superuser_or_staff_feature_flagged_permission_active_option(self) -> None:
        # With active superuser
        assert not self.superuser_staff_flagged_permission.has_permission(
            self.superuser_request, APIView()
        )

        # With active staff
        assert self.superuser_staff_flagged_permission.has_permission(self.staff_request, APIView())

    def test_superuser_or_staff_feature_flagged_permission_inactive_option(self) -> None:
        # With active staff
        assert not self.superuser_staff_flagged_permission.has_permission(
            self.staff_request, APIView()
        )

        # With active superuser
        assert self.superuser_staff_flagged_permission.has_permission(
            self.superuser_request, APIView()
        )


class DisallowImpersonatedTokenCreationTest(DRFPermissionTestCase):
    permission = DisallowImpersonatedTokenCreation()

    def setUp(self) -> None:
        super().setUp()
        self.normal_user = self.create_user()
        self.impersonator = self.create_user(is_superuser=True)

    def test_safe_methods_allowed_during_impersonation(self) -> None:
        for method in ("GET", "HEAD", "OPTIONS"):
            request = self.make_request(user=self.normal_user, method=method)
            request.actual_user = self.impersonator  # type: ignore[attr-defined]
            assert self.permission.has_permission(request, APIView())

    def test_unsafe_methods_blocked_during_impersonation(self) -> None:
        for method in ("POST", "PUT", "DELETE"):
            request = self.make_request(user=self.normal_user, method=method)
            request.actual_user = self.impersonator  # type: ignore[attr-defined]
            assert not self.permission.has_permission(request, APIView())

    def test_unsafe_methods_allowed_without_impersonation(self) -> None:
        for method in ("POST", "PUT", "DELETE"):
            request = self.make_request(user=self.normal_user, method=method)
            assert self.permission.has_permission(request, APIView())


class IsAuthenticatedPermissionsTest(DRFPermissionTestCase):
    user_permission = SentryIsAuthenticated()

    def setUp(self) -> None:
        super().setUp()
        self.normal_user = self.create_user()
        self.readonly_user = self.create_user()

    def test_has_permission(self) -> None:
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.users": [self.readonly_user.id]}
        ):
            assert self.user_permission.has_permission(
                self.make_request(self.normal_user), APIView()
            )
            assert not self.user_permission.has_permission(
                self.make_request(self.readonly_user), APIView()
            )

    def test_has_object_permission(self) -> None:
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.users": [self.readonly_user.id]}
        ):
            assert self.user_permission.has_object_permission(
                self.make_request(self.normal_user), APIView(), None
            )
            assert not self.user_permission.has_object_permission(
                self.make_request(self.readonly_user), APIView(), None
            )


class DemoSafePermissionsTest(DRFPermissionTestCase):
    user_permission = DemoSafePermission()

    def setUp(self) -> None:
        super().setUp()
        self.normal_user = self.create_user()
        self.readonly_user = self.create_user()
        self.organization = self.create_organization(owner=self.normal_user)
        self.org_member_scopes = self.create_member(
            organization_id=self.organization.id, user_id=self.readonly_user.id
        ).get_scopes()

    def _get_rpc_context(self, user):
        rpc_context = organization_service.get_organization_by_id(
            id=self.organization.id, user_id=user.id
        )

        assert rpc_context
        return rpc_context

    def test_safe_methods(self) -> None:
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.users": [self.readonly_user.id]}
        ):
            for method in ("GET", "HEAD", "OPTIONS"):
                assert self.user_permission.has_permission(
                    self.make_request(self.readonly_user, method=method), APIView()
                )
                assert self.user_permission.has_permission(
                    self.make_request(self.normal_user, method=method), APIView()
                )

    def test_unsafe_methods(self) -> None:
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.users": [self.readonly_user.id]}
        ):
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                assert not self.user_permission.has_permission(
                    self.make_request(self.readonly_user, method=method), APIView()
                )
                assert self.user_permission.has_permission(
                    self.make_request(self.normal_user, method=method), APIView()
                )

    def test_safe_method_demo_mode_disabled(self) -> None:
        with override_options(
            {"demo-mode.enabled": False, "demo-mode.users": [self.readonly_user.id]}
        ):
            for method in ("GET", "HEAD", "OPTIONS"):
                assert not self.user_permission.has_permission(
                    self.make_request(self.readonly_user, method=method), APIView()
                )
                assert self.user_permission.has_permission(
                    self.make_request(self.normal_user, method=method), APIView()
                )

    def test_unsafe_methods_demo_mode_disabled(self) -> None:
        with override_options(
            {"demo-mode.enabled": False, "demo-mode.users": [self.readonly_user.id]}
        ):
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                assert not self.user_permission.has_permission(
                    self.make_request(self.readonly_user, method=method), APIView()
                )
                assert self.user_permission.has_permission(
                    self.make_request(self.normal_user, method=method), APIView()
                )

    def test_determine_access_disabled(self) -> None:
        with override_options(
            {"demo-mode.enabled": False, "demo-mode.users": [self.readonly_user.id]}
        ):
            self.user_permission.determine_access(
                request=self.make_request(self.normal_user),
                organization=self._get_rpc_context(self.normal_user),
            )

            readonly_rpc_context = self._get_rpc_context(self.readonly_user)

            self.user_permission.determine_access(
                request=self.make_request(self.readonly_user),
                organization=readonly_rpc_context,
            )

            assert readonly_rpc_context.member.scopes == list(self.org_member_scopes)

    def test_determine_access(self) -> None:
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.users": [self.readonly_user.id]}
        ):
            self.user_permission.determine_access(
                request=self.make_request(self.normal_user),
                organization=self._get_rpc_context(self.normal_user),
            )

            readonly_rpc_context = self._get_rpc_context(self.readonly_user)

            self.user_permission.determine_access(
                request=self.make_request(self.readonly_user),
                organization=readonly_rpc_context,
            )

            assert readonly_rpc_context.member.scopes == sorted(READONLY_SCOPES)

    def test_determine_access_no_demo_users(self) -> None:
        with override_options({"demo-mode.enabled": False, "demo-mode.users": []}):
            self.user_permission.determine_access(
                request=self.make_request(self.normal_user),
                organization=self._get_rpc_context(self.normal_user),
            )

            readonly_rpc_context = self._get_rpc_context(self.readonly_user)

            self.user_permission.determine_access(
                request=self.make_request(self.readonly_user),
                organization=readonly_rpc_context,
            )

            assert readonly_rpc_context.member.scopes == list(self.org_member_scopes)


@no_silo_test
class PublishedMutationScopeTest(SimpleTestCase):
    def test_readonly_mutation_scope_exceptions_are_notes(self) -> None:
        for view_cls in sorted(
            set(_iter_endpoint_view_classes(get_resolver().url_patterns)), key=_get_class_path
        ):
            for cls in (view_cls, *getattr(view_cls, "permission_classes", ())):
                exceptions = getattr(cls, "readonly_mutation_scope_exceptions", None)
                if exceptions is None:
                    continue

                assert isinstance(exceptions, dict), (
                    f"{_get_class_path(cls)} readonly_mutation_scope_exceptions must be a dict"
                )

                for method, note in exceptions.items():
                    assert method in MUTATION_METHODS, (
                        f"{_get_class_path(cls)} readonly_mutation_scope_exceptions[{method!r}] "
                        "must target a mutation method"
                    )
                    assert isinstance(note, str) and note.strip(), (
                        f"{_get_class_path(cls)} readonly_mutation_scope_exceptions[{method!r}] "
                        "must be a non-empty note"
                    )

    def test_published_mutation_endpoints_require_readonly_scope_notes(self) -> None:
        missing_notes = []

        for view_cls in sorted(
            set(_iter_endpoint_view_classes(get_resolver().url_patterns)), key=_get_class_path
        ):
            publish_status = getattr(view_cls, "publish_status", {}) or {}
            permission_classes = getattr(view_cls, "permission_classes", ()) or ()
            view_exceptions = _get_readonly_mutation_scope_exceptions(view_cls)

            for method in MUTATION_METHODS & set(publish_status):
                for permission_cls in permission_classes:
                    readonly_scopes = (
                        set(getattr(permission_cls, "scope_map", {}).get(method, ()))
                        & SENTRY_READONLY_SCOPES
                    )
                    if not readonly_scopes:
                        continue

                    if view_exceptions.get(method) or _get_readonly_mutation_scope_exceptions(
                        permission_cls
                    ).get(method):
                        continue

                    missing_notes.append(
                        f"{_get_class_path(view_cls)} {method} accepts readonly scopes "
                        f"{sorted(readonly_scopes)} via {_get_class_path(permission_cls)}. "
                        "Remove the readonly scopes or add "
                        "readonly_mutation_scope_exceptions[method] with a justification note."
                    )

        assert not missing_notes, "\n".join(missing_notes)
