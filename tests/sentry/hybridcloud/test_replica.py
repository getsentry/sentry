from sentry.hybridcloud.models import ApiKeyReplica, ExternalActorReplica
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.models.outbox import outbox_context
from sentry.models.teamreplica import TeamReplica
from sentry.services.hybrid_cloud.auth.serial import serialize_auth_provider
from sentry.services.hybrid_cloud.replica import region_replica_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_external_actor():
    org = Factories.create_organization()
    integration = Factories.create_integration(organization=org, external_id="hohohomerrychristmas")
    user = Factories.create_user()
    team = Factories.create_team(organization=org)

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert ExternalActorReplica.objects.count() == 0

    xa1 = Factories.create_external_team(team=team, integration_id=integration.id, organization=org)
    xa2 = Factories.create_external_user(
        user=user, integration_id=integration.id, organization=org, external_id="12345"
    )

    with assume_test_silo_mode(SiloMode.CONTROL):
        xar1 = ExternalActorReplica.objects.get(externalactor_id=xa1.id)
        xar2 = ExternalActorReplica.objects.get(externalactor_id=xa2.id)

    assert xar1.user_id is None
    assert xar1.team_id == team.id
    assert xar1.externalactor_id == xa1.id
    assert xar1.organization_id == xa1.organization_id
    assert xar1.integration_id == xa1.integration_id
    assert xar1.provider == xa1.provider
    assert xar1.external_name == xa1.external_name
    assert xar1.external_id == xa1.external_id

    assert xar2.user_id == user.id
    assert xar2.team_id is None
    assert xar2.externalactor_id == xa2.id
    assert xar2.organization_id == xa2.organization_id
    assert xar2.integration_id == xa2.integration_id
    assert xar2.provider == xa2.provider
    assert xar2.external_name == xa2.external_name
    assert xar2.external_id == xa2.external_id

    with assume_test_silo_mode(SiloMode.REGION):
        xa2.user_id = 12382317  # not a user id
        xa2.save()

    with assume_test_silo_mode(SiloMode.CONTROL):
        xar2 = ExternalActorReplica.objects.get(externalactor_id=xa2.id)

    # Did not update with bad user id.
    assert xar2.user_id == user.id


@django_db_all(transaction=True)
@all_silo_test(regions=create_test_regions("us"))
def test_replicate_auth_provider():
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.REGION):
        assert AuthProviderReplica.objects.count() == 0

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = AuthProviderReplica.objects.get(organization_id=org.id)

    assert replicated.auth_provider_id == auth_provider.id
    assert replicated.provider == auth_provider.provider
    assert replicated.config == auth_provider.config
    assert replicated.default_role == auth_provider.default_role
    assert replicated.default_global_access == auth_provider.default_global_access
    assert replicated.scim_enabled == auth_provider.flags.scim_enabled
    assert replicated.allow_unlinked == auth_provider.flags.allow_unlinked

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider.provider = "new_provider"
        auth_provider.flags.scim_enabled = not auth_provider.flags.scim_enabled
        auth_provider.save()

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = AuthProviderReplica.objects.get(organization_id=org.id)

    assert replicated.auth_provider_id == auth_provider.id
    assert replicated.provider == auth_provider.provider
    assert replicated.scim_enabled == auth_provider.flags.scim_enabled

    serialized = serialize_auth_provider(auth_provider)
    serialized.organization_id = 99999

    # Should still succeed despite non existent organization
    region_replica_service.upsert_replicated_auth_provider(
        auth_provider=serialized, region_name="us"
    )


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_api_key():
    org = Factories.create_organization()
    with assume_test_silo_mode(SiloMode.CONTROL):
        api_key = Factories.create_api_key(org, scope_list=["a", "b"])

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = ApiKeyReplica.objects.get(apikey_id=api_key.id)

    assert replicated.get_scopes() == api_key.get_scopes()

    with assume_test_silo_mode(SiloMode.CONTROL):
        api_key.scope_list = ["a", "b", "c"]
        api_key.save()

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = ApiKeyReplica.objects.get(apikey_id=api_key.id)

    assert replicated.get_scopes() == api_key.get_scopes()


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_auth_identity():
    user = Factories.create_user()
    user2 = Factories.create_user()
    user3 = Factories.create_user()
    org = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.REGION):
        assert AuthIdentityReplica.objects.count() == 0

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
        auth_identity = AuthIdentity.objects.create(
            user=user, auth_provider=auth_provider, ident="some-ident", data={"b": 2}
        )

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = AuthIdentityReplica.objects.get(
            ident=auth_identity.ident, auth_provider_id=auth_provider.id
        )

    assert replicated.auth_identity_id == auth_identity.id
    assert replicated.auth_provider_id == auth_identity.auth_provider_id
    assert replicated.user_id == auth_identity.user_id
    assert replicated.data == auth_identity.data
    assert replicated.ident == auth_identity.ident

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_identity.data = {"v": "new data"}
        auth_identity.save()

    with assume_test_silo_mode(SiloMode.REGION):
        replicated = AuthIdentityReplica.objects.get(
            ident=auth_identity.ident, auth_provider_id=auth_provider.id
        )

    assert replicated.auth_identity_id == auth_identity.id
    assert replicated.data == auth_identity.data

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_identities = [
            auth_identity,
            AuthIdentity.objects.create(
                user=user2, auth_provider=auth_provider, ident="some-ident-2", data={"b": 2}
            ),
            AuthIdentity.objects.create(
                user=user3, auth_provider=auth_provider, ident="some-ident-3", data={"b": 2}
            ),
        ]
        auth_idents = [ai.ident for ai in auth_identities]
        conflicting_pairs = list(zip(auth_identities, [*auth_idents[1:], auth_idents[0]]))

        with outbox_runner(), outbox_context(flush=False):
            for ai in auth_identities:
                ai.ident += "-new"
                ai.save()

            for ai, next_ident in conflicting_pairs:
                ai.ident = next_ident
                ai.save()

        with assume_test_silo_mode(SiloMode.REGION):
            for ai, next_ident in zip(auth_identities, [*auth_idents[1:], auth_idents[0]]):
                assert AuthIdentityReplica.objects.get(auth_identity_id=ai.id).ident == next_ident


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_team():
    org = Factories.create_organization()
    with assume_test_silo_mode(SiloMode.CONTROL):
        assert TeamReplica.objects.count() == 0

    with assume_test_silo_mode(SiloMode.REGION):
        team = Factories.create_team(org)

    with assume_test_silo_mode(SiloMode.CONTROL):
        replicated = TeamReplica.objects.get(team_id=team.id)

    assert replicated.organization_id == team.organization_id
    assert replicated.slug == team.slug
    assert replicated.name == team.name
    assert replicated.status == team.status
    assert replicated.org_role == team.org_role

    with assume_test_silo_mode(SiloMode.REGION):
        team.org_role = "boo"
        team.save()

    with assume_test_silo_mode(SiloMode.CONTROL):
        replicated = TeamReplica.objects.get(team_id=team.id)

    assert replicated.org_role == team.org_role

    with assume_test_silo_mode(SiloMode.REGION):
        teams = [
            team,
            Factories.create_team(organization=team.organization),
            Factories.create_team(organization=team.organization),
        ]
        team_slugs = [team.slug for team in teams]
        conflicting_pairs = list(zip(teams, [*team_slugs[1:], team_slugs[0]]))

        with outbox_runner(), outbox_context(flush=False):
            for team in teams:
                team.slug += "-new"
                team.save()

            for team, next_slug in conflicting_pairs:
                team.slug = next_slug
                team.save()

        with assume_test_silo_mode(SiloMode.CONTROL):
            for team, next_slug in zip(teams, [*team_slugs[1:], team_slugs[0]]):
                assert TeamReplica.objects.get(team_id=team.id).slug == next_slug


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_organization_member_team():
    org = Factories.create_organization()
    team = Factories.create_team(org)
    user = Factories.create_user()
    member = Factories.create_member(organization=org, user=user)
    with assume_test_silo_mode(SiloMode.CONTROL):
        assert OrganizationMemberTeamReplica.objects.count() == 0

    omt = Factories.create_team_membership(team=team, member=member)

    with assume_test_silo_mode(SiloMode.CONTROL):
        replicated = OrganizationMemberTeamReplica.objects.get(organizationmemberteam_id=omt.id)

    assert replicated.organization_id == omt.organizationmember.organization_id
    assert replicated.team_id == omt.team_id
    assert replicated.organizationmember_id == omt.organizationmember_id
    assert replicated.organizationmemberteam_id == omt.id
    assert replicated.is_active == omt.is_active
    assert replicated.role == omt.role

    with assume_test_silo_mode(SiloMode.REGION):
        omt.role = "boo"
        omt.save()

    with assume_test_silo_mode(SiloMode.CONTROL):
        replicated = OrganizationMemberTeamReplica.objects.get(organizationmemberteam_id=omt.id)

    assert replicated.role == "boo"
