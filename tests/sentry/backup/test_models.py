from __future__ import annotations

import tempfile
from pathlib import Path

from sentry.backup.dependencies import NormalizedModelName
from sentry.backup.scopes import ExportScope, RelocationScope
from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apitoken import ApiToken
from sentry.models.notificationaction import NotificationAction, NotificationActionProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.backups import export_to_file
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils.json import JSONData
from tests.sentry.backup import mark, targets

DYNAMIC_RELOCATION_SCOPE_TESTED: set[NormalizedModelName] = set()


# There is no need to in both monolith and region mode for model-level unit tests - region mode
# testing along should suffice.
@region_silo_test
class DynamicRelocationScopeTests(TransactionTestCase):
    """
    For models that support different relocation scopes depending on properties of the model instance itself (ie, they have a set for their `__relocation_scope__`, rather than a single value), make sure that this dynamic deduction works correctly.
    """

    def export(self) -> JSONData:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.expect.json")
            return export_to_file(tmp_path, ExportScope.Global)

    @targets(mark(DYNAMIC_RELOCATION_SCOPE_TESTED, ApiAuthorization, ApiToken))
    def test_api_auth(self):
        user = self.create_user()

        # Bound to an app == global scope.
        with assume_test_silo_mode(SiloMode.CONTROL):
            app = ApiApplication.objects.create(name="test", owner=user)
            auth = ApiAuthorization.objects.create(
                application=app, user=self.create_user("api_app@example.com")
            )
            token = ApiToken.objects.create(
                application=app, user=user, expires_at=None, name="test_api_auth_application_bound"
            )

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert auth.get_relocation_scope() == RelocationScope.Global
        assert token.get_relocation_scope() == RelocationScope.Global

        # Unbound to an app == config scope.
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth = ApiAuthorization.objects.create(user=self.create_user("api_auth@example.com"))
            token = ApiToken.objects.create(
                user=user, expires_at=None, name="test_api_auth_not_bound"
            )

        assert auth.get_relocation_scope() == RelocationScope.Config
        assert token.get_relocation_scope() == RelocationScope.Config
        return self.export()

    @targets(mark(DYNAMIC_RELOCATION_SCOPE_TESTED, NotificationAction, NotificationActionProject))
    def test_notification_action(self):
        # Bound to an app == global scope.
        app = self.create_sentry_app(name="test_app", organization=self.organization)
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project], sentry_app_id=app.id
        )
        action_project = NotificationActionProject.objects.get(action=action)

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert action.get_relocation_scope() == RelocationScope.Global
        assert action_project.get_relocation_scope() == RelocationScope.Global

        # Bound to an integration == global scope.
        integration = self.create_integration(
            self.organization, provider="slack", name="Slack 1", external_id="slack:1"
        )
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project], integration_id=integration.id
        )
        action_project = NotificationActionProject.objects.get(action=action)

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert action.get_relocation_scope() == RelocationScope.Global
        assert action_project.get_relocation_scope() == RelocationScope.Global

        # Unbound to an app or integration == organization scope.
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project]
        )
        action_project = NotificationActionProject.objects.get(action=action)

        assert action.get_relocation_scope() == RelocationScope.Organization
        assert action_project.get_relocation_scope() == RelocationScope.Organization
        return self.export()
