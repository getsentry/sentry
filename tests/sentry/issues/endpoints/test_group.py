from typing import ContextManager

from rest_framework.views import APIView

from sentry.issues.endpoints.bases.group import GroupAiEndpoint, GroupAiPermission
from sentry.models.apitoken import ApiToken
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.requests import drf_request_from_request
from sentry.users.models.user import User


class GroupAiPermissionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.permission = GroupAiPermission()
        self.demo_org = self.create_organization(name="demo-org")
        self.demo_project = self.create_project(organization=self.demo_org)
        self.demo_group = self.create_group(project=self.demo_project)
        self.demo_user = self.create_user()
        self.create_member(
            user=self.demo_user,
            organization=self.demo_org,
            role="member",
            teams=[self.demo_project.teams.first()],
        )

        # Keep legacy aliases so existing tests still work
        self.project = self.demo_project
        self.group = self.demo_group

        # A separate org the demo user has no membership in
        self.other_org = self.create_organization(name="other-org")
        self.other_project = self.create_project(organization=self.other_org)
        self.other_group = self.create_group(project=self.other_project)

    def _demo_mode_enabled(self) -> ContextManager[None]:
        return override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [self.demo_user.id],
                "demo-mode.orgs": [self.demo_org.id],
            }
        )

    def has_object_perm(
        self,
        method: str,
        obj: Group,
        auth: ApiToken | None = None,
        user: User | None = None,
        is_superuser: bool | None = None,
    ) -> bool:
        request = self.make_request(user=user, auth=auth, method=method, is_superuser=is_superuser)
        drf_request = drf_request_from_request(request)
        return self.permission.has_permission(
            drf_request, APIView()
        ) and self.permission.has_object_permission(drf_request, APIView(), obj)

    def test_demo_user_safe_methods(self) -> None:
        with self._demo_mode_enabled():
            for method in ("GET", "HEAD", "OPTIONS"):
                assert self.has_object_perm(method, self.group, user=self.demo_user)

    def test_demo_user_post_allowed(self) -> None:
        with self._demo_mode_enabled():
            assert self.has_object_perm("POST", self.group, user=self.demo_user)

    def test_demo_user_unsafe_methods_blocked(self) -> None:
        with self._demo_mode_enabled():
            for method in ("PUT", "DELETE", "PATCH"):
                assert not self.has_object_perm(method, self.group, user=self.demo_user)

    def test_demo_user_demo_mode_disabled(self) -> None:
        """When demo mode is off, demo user goes through normal auth — no special bypass."""
        with override_options({"demo-mode.users": [self.demo_user.id]}):
            # Has membership in demo_org → normal auth grants access
            assert self.has_object_perm("GET", self.demo_group, user=self.demo_user)
            # No membership in other_org → normal auth denies
            assert not self.has_object_perm("GET", self.other_group, user=self.demo_user)

    def test_demo_user_blocked_from_non_demo_org_group(self) -> None:
        """Demo user must not access groups belonging to a non-demo org."""
        with self._demo_mode_enabled():
            for method in ("GET", "POST"):
                assert not self.has_object_perm(method, self.other_group, user=self.demo_user), (
                    f"Demo user got access to non-demo org group via {method}"
                )

    def test_demo_user_allowed_on_demo_org_group(self) -> None:
        """Demo user can access groups in the demo org."""
        with self._demo_mode_enabled():
            for method in ("GET", "POST"):
                assert self.has_object_perm(method, self.demo_group, user=self.demo_user), (
                    f"Demo user denied access to demo org group via {method}"
                )

    def test_regular_user_with_access(self) -> None:
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.project.organization,
            role="member",
            teams=[self.project.teams.first()],
        )

        assert self.has_object_perm("GET", self.group, user=user)
        assert self.has_object_perm("POST", self.group, user=user)
        assert self.has_object_perm("DELETE", self.group, user=user)

    def test_superuser_access(self) -> None:
        superuser = self.create_user(is_superuser=True)

        for method in ("GET", "POST", "PUT", "DELETE"):
            assert self.has_object_perm(method, self.group, user=superuser, is_superuser=True)


class GroupAiEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.endpoint = GroupAiEndpoint()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def test_permission_classes(self) -> None:
        assert hasattr(self.endpoint, "permission_classes")
        assert self.endpoint.permission_classes == (GroupAiPermission,)
