from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders, IntegrationProviderSlug
from sentry.notifications.platform.strategies.utils import (
    get_targets_from_participant_map,
)
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.notifications.utils.participants import ParticipantMap
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.slack import add_identity, install_slack
from sentry.types.actor import Actor, ActorType


class GetTargetsFromParticipantMapTest(TestCase):
    def test_empty_participant_map(self) -> None:
        participant_map = ParticipantMap()
        result = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )
        assert result == []

    def test_email_user_target(self) -> None:
        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=self.user.id, actor_type=ActorType.USER),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        assert len(targets) == 1
        target = targets[0]
        assert isinstance(target, GenericNotificationTarget)
        assert target.provider_key == NotificationProviderKey.EMAIL
        assert target.resource_type == NotificationTargetResourceType.EMAIL
        assert target.resource_id == self.user.email
        assert target.specific_data == {"user_id": self.user.id}

    def test_email_multiple_users(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        self.create_member(organization=self.organization, user=user_a)
        self.create_member(organization=self.organization, user=user_b)

        participant_map = ParticipantMap()
        for u in (user_a, user_b):
            participant_map.add(
                ExternalProviders.EMAIL,
                Actor(id=u.id, actor_type=ActorType.USER),
                0,
            )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        emails = {t.resource_id for t in targets}
        assert "a@example.com" in emails
        assert "b@example.com" in emails

    def test_email_team_expands_to_members(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=user_a)
        self.create_team_membership(team=team, user=user_b)

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=team.id, actor_type=ActorType.TEAM),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        emails = {t.resource_id for t in targets}
        assert "a@example.com" in emails
        assert "b@example.com" in emails

    def test_email_user_and_team_deduplicates(self) -> None:
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=self.user)

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=self.user.id, actor_type=ActorType.USER),
            0,
        )
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=team.id, actor_type=ActorType.TEAM),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        emails = [t.resource_id for t in targets]
        assert emails.count(self.user.email) == 1

    def test_email_skips_users_without_email(self) -> None:
        user_no_email = self.create_user(email="")
        self.create_member(organization=self.organization, user=user_no_email)

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=user_no_email.id, actor_type=ActorType.USER),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        assert targets == []


class GetTargetsSlackUserTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, external_id="UXXXXXXX1")

    def test_slack_user_target(self) -> None:
        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=self.user.id, actor_type=ActorType.USER),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        assert len(slack_targets) == 1
        target = slack_targets[0]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.resource_type == NotificationTargetResourceType.DIRECT_MESSAGE
        assert target.resource_id == "UXXXXXXX1"
        assert target.integration_id == self.integration.id
        assert target.organization_id == self.organization.id
        assert target.specific_data == {"user_id": self.user.id}

    def test_slack_user_no_identity_returns_empty(self) -> None:
        other_user = self.create_user(email="other@example.com")
        self.create_member(organization=self.organization, user=other_user)

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=other_user.id, actor_type=ActorType.USER),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        assert slack_targets == []

    def test_slack_empty_user_ids_returns_empty(self) -> None:
        participant_map = ParticipantMap()
        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )
        assert targets == []


class GetTargetsSlackTeamTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.team = self.create_team(organization=self.organization)

    def test_slack_team_target(self) -> None:
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="test-channel",
            external_id="C1234567890",
        )

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=self.team.id, actor_type=ActorType.TEAM),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        assert len(slack_targets) == 1
        target = slack_targets[0]
        assert isinstance(target, IntegrationNotificationTarget)
        assert target.resource_type == NotificationTargetResourceType.CHANNEL
        assert target.resource_id == "C1234567890"
        assert target.integration_id == self.integration.id
        assert target.organization_id == self.organization.id
        assert target.specific_data == {"team_id": self.team.id}

    def test_slack_team_no_external_actor_returns_empty(self) -> None:
        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=self.team.id, actor_type=ActorType.TEAM),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        assert slack_targets == []

    def test_slack_team_excludes_null_external_id(self) -> None:
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="test-channel",
            external_id=None,
        )

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=self.team.id, actor_type=ActorType.TEAM),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        assert slack_targets == []

    def test_slack_team_multiple_external_actors(self) -> None:
        team_b = self.create_team(organization=self.organization)
        for team, chan_id in [(self.team, "C111"), (team_b, "C222")]:
            ExternalActor.objects.create(
                team_id=team.id,
                organization_id=self.organization.id,
                integration_id=self.integration.id,
                provider=ExternalProviders.SLACK.value,
                external_name="chan",
                external_id=chan_id,
            )

        participant_map = ParticipantMap()
        for t in (self.team, team_b):
            participant_map.add(
                ExternalProviders.SLACK,
                Actor(id=t.id, actor_type=ActorType.TEAM),
                0,
            )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        slack_targets = [t for t in targets if t.provider_key == NotificationProviderKey.SLACK]
        channel_ids = {t.resource_id for t in slack_targets}
        assert channel_ids == {"C111", "C222"}


class GetTargetsCombinedTest(TestCase):
    def test_email_and_slack_combined(self) -> None:
        integration = install_slack(self.organization)
        add_identity(integration, self.user, external_id="UXXXXXXX1")

        participant_map = ParticipantMap()
        participant_map.add(
            ExternalProviders.EMAIL,
            Actor(id=self.user.id, actor_type=ActorType.USER),
            0,
        )
        participant_map.add(
            ExternalProviders.SLACK,
            Actor(id=self.user.id, actor_type=ActorType.USER),
            0,
        )

        targets = get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )

        provider_keys = {t.provider_key for t in targets}
        assert NotificationProviderKey.EMAIL in provider_keys
        assert NotificationProviderKey.SLACK in provider_keys
