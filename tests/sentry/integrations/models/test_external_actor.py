from sentry.integrations.models.external_actor import ExternalActor
from sentry.testutils.cases import TestCase


class ExternalActorTest(TestCase):
    def setUp(self) -> None:
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)

        integrations = [
            self.create_integration(
                organization=org, external_id=f"integration-{i}", provider="jira"
            )
            for i in range(10)
        ]
        target_integration = integrations[len(integrations) // 2]

        self.external_actor = ExternalActor.objects.create(
            team_id=team.id,
            organization=org,
            integration_id=target_integration.id,
            provider=0,
            external_name="testname",
        )

    def test_delete(self):
        obj_id = self.external_actor.id
        self.external_actor.delete()
        assert list(ExternalActor.objects.filter(id=obj_id)) == []
