from sentry.models import Organization, Project, Team
from sentry.notifications.helpers import get_scope
from sentry.notifications.types import NotificationScopeType
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GetScopeTestCase(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()

    def test_get_scope_user(self):
        scope_type, scope_identifier = get_scope(actor=RpcActor.from_orm_user(self.user))
        assert scope_type == NotificationScopeType.USER
        assert scope_identifier == self.user.id

    def test_get_scope_team(self):
        team = Team(id=1)
        scope_type, scope_identifier = get_scope(actor=RpcActor.from_orm_team(team))
        assert scope_type == NotificationScopeType.TEAM
        assert scope_identifier == team.id

    def test_get_scope_project(self):
        project = Project(id=1)
        scope_type, scope_identifier = get_scope(
            actor=RpcActor.from_orm_user(self.user), project=project
        )
        assert scope_type == NotificationScopeType.PROJECT
        assert scope_identifier == project.id

        scope_type, scope_identifier = get_scope(
            actor=RpcActor.from_orm_user(self.user), project=project.id
        )
        assert scope_type == NotificationScopeType.PROJECT
        assert scope_identifier == project.id

    def test_get_scope_organization(self):
        organization = Organization(id=1)
        scope_type, scope_identifier = get_scope(
            actor=RpcActor.from_orm_user(self.user), organization=organization
        )
        assert scope_type == NotificationScopeType.ORGANIZATION
        assert scope_identifier == organization.id

        scope_type, scope_identifier = get_scope(
            actor=RpcActor.from_orm_user(self.user), organization=organization.id
        )
        assert scope_type == NotificationScopeType.ORGANIZATION
        assert scope_identifier == organization.id
