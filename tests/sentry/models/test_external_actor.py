from sentry.models import ACTOR_TYPES, Actor, ExternalActor
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ExternalActorTest(TestCase):
    def setUp(self) -> None:
        actor = Actor.objects.create(type=ACTOR_TYPES["team"])
        org = self.create_organization()
        self.create_team(organization=org, actor=actor)

        integrations = [
            self.create_integration(
                organization=org, external_id=f"integration-{i}", provider="jira"
            )
            for i in range(10)
        ]
        target_integration = integrations[len(integrations) // 2]

        self.external_actor = ExternalActor.objects.create(
            actor=actor,
            organization=org,
            integration_id=target_integration.id,
            provider=0,
            external_name="testname",
        )

    def test_delete(self):
        obj_id = self.external_actor.id
        self.external_actor.delete()
        assert list(ExternalActor.objects.filter(id=obj_id)) == []
