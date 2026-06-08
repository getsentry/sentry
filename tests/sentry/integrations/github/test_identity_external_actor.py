from unittest import mock

from sentry.constants import ObjectStatus
from sentry.identity.github.provider import (
    GitHubIdentityProvider,
    ensure_external_actors_for_github_identity,
)
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import (
    ExternalActorSource,
    ExternalProviders,
    IntegrationProviderSlug,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import no_silo_test


# Monolith mode: the orchestrator reads control models (OrganizationMemberMapping/
# OrganizationIntegration) and writes the cell-silo ExternalActor via RPC, and the
# assertions read ExternalActor back -- all of which must be locally accessible.
@no_silo_test
class EnsureExternalActorsForGithubIdentityTest(TestCase):
    github_login = "octocat"
    github_id = "583231"
    external_name = "@octocat"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.create_user())
        with outbox_runner():
            self.create_member(user=self.user, organization=self.organization)
        assert not ExternalActor.objects.exists()

    def _github_integration(self, organization=None, **kwargs):
        return self.create_integration(
            organization=organization or self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            external_id=kwargs.pop("external_id", "github:1"),
            **kwargs,
        )

    def _external_actors(self, **filters):
        return ExternalActor.objects.filter(**filters)

    def test_creates_external_actor_for_github_integrated_org(self):
        integration = self._github_integration()

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        actor = self._external_actors(
            organization_id=self.organization.id, user_id=self.user.id
        ).get()
        assert actor.provider == ExternalProviders.GITHUB.value
        assert actor.external_name == self.external_name
        assert actor.external_id == self.github_id
        assert actor.integration_id == integration.id
        assert actor.source == ExternalActorSource.IDENTITY.value

    def test_null_github_id_yields_null_external_id(self):
        self._github_integration()

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=None
        )

        actor = self._external_actors(user_id=self.user.id).get()
        assert actor.external_name == self.external_name
        assert actor.external_id is None

    def test_idempotent(self):
        self._github_integration()

        for _ in range(2):
            ensure_external_actors_for_github_identity(
                user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
            )

        assert self._external_actors(user_id=self.user.id).count() == 1

    def test_skips_org_without_github_integration(self):
        # Org membership exists but no GitHub integration is installed.
        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        assert not self._external_actors(user_id=self.user.id).exists()

    def test_skips_org_user_is_not_a_member_of(self):
        other_org = self.create_organization(owner=self.create_user())
        self._github_integration(organization=other_org)

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        assert not self._external_actors(organization_id=other_org.id).exists()

    def test_skips_disabled_github_integration(self):
        self._github_integration(oi_params={"status": ObjectStatus.DISABLED})

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        assert not self._external_actors(user_id=self.user.id).exists()

    def test_only_maps_github_provider_integrations(self):
        # A non-GitHub integration in the same org must not produce a mapping.
        self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.SLACK.value,
            external_id="slack:1",
        )

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        assert not self._external_actors(user_id=self.user.id).exists()

    def test_fans_out_across_multiple_github_orgs(self):
        second_org = self.create_organization(owner=self.create_user())
        with outbox_runner():
            self.create_member(user=self.user, organization=second_org)
        self._github_integration()
        self._github_integration(organization=second_org, external_id="github:2")

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
        )

        assert self._external_actors(user_id=self.user.id).count() == 2

    def test_missing_login_is_noop(self):
        self._github_integration()

        ensure_external_actors_for_github_identity(
            user_id=self.user.id, github_login=None, github_id=self.github_id
        )

        assert not self._external_actors(user_id=self.user.id).exists()

    def test_user_with_no_memberships_is_noop(self):
        loner = self.create_user()

        ensure_external_actors_for_github_identity(
            user_id=loner.id, github_login=self.github_login, github_id=self.github_id
        )

        assert not self._external_actors(user_id=loner.id).exists()

    def test_rpc_failure_is_swallowed_best_effort(self):
        self._github_integration()

        with mock.patch(
            "sentry.organizations.services.organization.organization_service.upsert_external_actor",
            side_effect=Exception("boom"),
        ):
            # Must not propagate: a failed mapping never breaks the identity-link flow.
            ensure_external_actors_for_github_identity(
                user_id=self.user.id, github_login=self.github_login, github_id=self.github_id
            )

        assert not self._external_actors(user_id=self.user.id).exists()


@no_silo_test
class GitHubIdentityProviderPostLinkTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.create_user())
        with outbox_runner():
            self.create_member(user=self.user, organization=self.organization)
        self.integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            external_id="github:1",
        )

    def test_post_link_identity_creates_external_actor(self):
        provider = GitHubIdentityProvider()

        provider.post_link_identity(
            {"type": "github", "id": 583231, "login": "octocat"}, self.user.id
        )

        actor = ExternalActor.objects.get(
            organization_id=self.organization.id, user_id=self.user.id
        )
        assert actor.external_name == "@octocat"
        assert actor.external_id == "583231"
        assert actor.provider == ExternalProviders.GITHUB.value

    def test_post_link_identity_without_github_id_sets_null_external_id(self):
        provider = GitHubIdentityProvider()

        # A payload without a numeric "id" still yields a mapping keyed on the login.
        provider.post_link_identity({"type": "github", "login": "octocat"}, self.user.id)

        actor = ExternalActor.objects.get(
            organization_id=self.organization.id, user_id=self.user.id
        )
        assert actor.external_name == "@octocat"
        assert actor.external_id is None
