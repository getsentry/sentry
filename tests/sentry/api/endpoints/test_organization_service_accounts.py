from __future__ import annotations

import hashlib
from unittest.mock import MagicMock, patch

from rest_framework.test import APIClient

from sentry.issues.action_log import GroupActionActor
from sentry.issues.action_log.types import ResolveAction
from sentry.models.activity import Activity
from sentry.models.apitoken import ApiToken
from sentry.models.group import GroupStatus
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationonboardingtask import OnboardingTask, OrganizationOnboardingTask
from sentry.models.serviceaccount import ServiceAccount
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.action_log import capture_action_log
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:service-accounts"


class OrganizationServiceAccountsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/service-accounts/"

    def _create(self, **overrides):
        payload = {
            "name": "Deploy bot",
            "role": "member",
            "tokenName": "Production",
            "scopes": ["org:read", "project:read", "event:read"],
            **overrides,
        }
        with self.feature(FEATURE):
            return self.client.post(self.url, data=payload, format="json")

    def test_feature_flag_is_required(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_create_and_list_with_read_once_secret(self) -> None:
        team = self.create_team(organization=self.organization, slug="deploys")
        response = self._create(teams=[team.slug])

        assert response.status_code == 201, response.content
        assert response.data["name"] == "Deploy bot"
        assert response.data["role"] == "member"
        assert response.data["teams"] == [team.slug]
        assert response.data["token"].startswith("sntryu_")
        assert response.data["tokens"][0]["scopes"] == [
            "event:read",
            "org:read",
            "project:read",
        ]

        with assume_test_silo_mode(SiloMode.CONTROL):
            account = ServiceAccount.objects.get(id=response.data["id"])
            token = ApiToken.objects.get(service_account=account)
        member = OrganizationMember.objects.get(
            organization=self.organization, service_account_id=account.id
        )
        assert member.user_id is None
        assert list(member.teams.all()) == [team]
        assert token.user_id is None
        assert token.scoping_organization_id is None
        assert token.hashed_token == hashlib.sha256(response.data["token"].encode()).hexdigest()

        with self.feature(FEATURE):
            listed = self.client.get(self.url)
        assert listed.status_code == 200
        assert len(listed.data) == 1
        assert "token" not in listed.data[0]
        assert listed.data[0]["tokens"][0]["tokenLastCharacters"] == response.data["token"][-4:]

    def test_duplicate_name_is_rejected_without_orphan_membership(self) -> None:
        assert self._create().status_code == 201
        response = self._create()
        assert response.status_code == 409
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.count() == 1
        assert OrganizationMember.objects.filter(service_account_id__isnull=False).count() == 1

    def test_lifecycle_token_rotation_and_revocation(self) -> None:
        created = self._create()
        assert created.status_code == 201, created.content
        account_id = created.data["id"]
        details_url = f"{self.url}{account_id}/"
        tokens_url = f"{details_url}tokens/"

        with self.feature(FEATURE):
            updated = self.client.put(
                details_url,
                data={"name": "Release bot", "role": "manager", "isActive": True},
                format="json",
            )
            rotated = self.client.post(
                tokens_url,
                data={"name": "Rotated", "scopes": ["org:read"]},
                format="json",
            )

        assert updated.status_code == 200, updated.content
        assert updated.data["name"] == "Release bot"
        assert updated.data["role"] == "manager"
        assert rotated.status_code == 201, rotated.content
        assert rotated.data["token"].startswith("sntryu_")
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ApiToken.objects.filter(service_account_id=account_id).count() == 2

        with self.feature(FEATURE):
            revoked = self.client.delete(f"{tokens_url}{rotated.data['id']}/")
        assert revoked.status_code == 204
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ApiToken.objects.filter(service_account_id=account_id).count() == 1

        with self.feature(FEATURE):
            deleted = self.client.delete(details_url)
        assert deleted.status_code == 204
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(id=account_id).exists()
            assert not ApiToken.objects.filter(service_account_id=account_id).exists()
        assert not OrganizationMember.objects.filter(service_account_id=account_id).exists()

    def test_service_account_token_uses_member_teams_and_token_scope_cap(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        allowed_team = self.create_team(organization=self.organization, slug="allowed")
        other_team = self.create_team(organization=self.organization, slug="other")
        allowed_project = self.create_project(
            organization=self.organization, teams=[allowed_team], slug="allowed-project"
        )
        self.create_project(
            organization=self.organization, teams=[other_team], slug="other-project"
        )

        created = self._create(
            role="member",
            teams=[allowed_team.slug],
            scopes=["org:read", "project:read"],
        )
        assert created.status_code == 201, created.content
        client = APIClient()
        headers = {"HTTP_AUTHORIZATION": f"Bearer {created.data['token']}"}

        projects = client.get(f"/api/0/organizations/{self.organization.slug}/projects/", **headers)
        write = client.put(
            f"/api/0/organizations/{self.organization.slug}/",
            data={},
            format="json",
            **headers,
        )

        assert projects.status_code == 200, projects.content
        assert {int(project["id"]) for project in projects.data} == {allowed_project.id}
        assert write.status_code == 403
        assert write["WWW-Authenticate"].startswith('Bearer error="insufficient_scope"')
        assert "org:write" in write["WWW-Authenticate"]

    def test_open_membership_matches_user_membership_semantics(self) -> None:
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])
        created = self._create(teams=[], scopes=["org:read", "project:read"])
        client = APIClient()

        response = client.get(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )

        assert response.status_code == 200, response.content
        assert {int(item["id"]) for item in response.data} == {project.id}

    def test_service_account_team_creation_joins_the_service_account_member(self) -> None:
        created = self._create(role="owner", scopes=["org:read", "team:write"])

        response = APIClient().post(
            f"/api/0/organizations/{self.organization.slug}/teams/",
            data={"name": "Automation"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )

        assert response.status_code == 201, response.content
        assert response.data["isMember"] is True
        team = Team.objects.get(organization=self.organization, slug="automation")
        member = OrganizationMember.objects.get(
            organization=self.organization,
            service_account_id=created.data["id"],
        )
        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()

    def test_service_account_project_creation_skips_human_onboarding_state(self) -> None:
        created = self._create(
            role="owner",
            scopes=["org:read", "org:write", "project:admin", "project:write"],
        )

        response = APIClient().post(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            data={"name": "Automated project", "platform": "python"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )

        assert response.status_code == 201, response.content
        assert not OrganizationOnboardingTask.objects.filter(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
        ).exists()

    @patch("sentry.tasks.commits.fetch_commits")
    def test_service_account_release_refs_do_not_use_actor_id_as_user_id(
        self, fetch_commits: MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])
        repository = self.create_repo(project=project, provider="dummy")
        created = self._create(
            teams=[team.slug],
            scopes=["project:read", "project:releases"],
        )

        response = APIClient().post(
            f"/api/0/organizations/{self.organization.slug}/releases/",
            data={
                "version": "service-account-release",
                "projects": [project.slug],
                "refs": [{"commit": "a" * 40, "repository": repository.name}],
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )

        assert response.status_code == 201, response.content
        fetch_commits.apply_async.assert_called_once()
        assert fetch_commits.apply_async.call_args.kwargs["kwargs"]["user_id"] is None

    def test_service_account_updates_issue_without_user_state(self) -> None:
        team = self.create_team(organization=self.organization)
        project = self.create_project(organization=self.organization, teams=[team])
        group = self.create_group(project=project)
        created = self._create(
            teams=[team.slug],
            scopes=["event:read", "event:write", "org:read", "project:read"],
        )
        client = APIClient()
        headers = {"HTTP_AUTHORIZATION": f"Bearer {created.data['token']}"}

        with capture_action_log() as action_log:
            resolved = client.put(
                f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
                data={"status": "resolved"},
                format="json",
                **headers,
            )
        personal_write = client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
            data={"isBookmarked": True},
            format="json",
            **headers,
        )

        assert resolved.status_code == 200, resolved.content
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        activity = Activity.objects.filter(group=group).latest("id")
        assert activity.user_id is None
        assert not GroupSubscription.objects.filter(group=group).exists()
        action_log.assert_logged(
            ResolveAction,
            group_id=group.id,
            actor=GroupActionActor.service_account(int(created.data["id"])),
        )
        assert personal_write.status_code == 403, personal_write.content
        assert not GroupBookmark.objects.filter(group=group).exists()

    def test_disabled_account_invalidates_existing_tokens(self) -> None:
        created = self._create()
        account_id = created.data["id"]
        token = created.data["token"]
        with self.feature(FEATURE):
            response = self.client.put(
                f"{self.url}{account_id}/",
                data={"isActive": False},
                format="json",
            )
        assert response.status_code == 200

        denied = APIClient().get(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert denied.status_code == 401

    def test_account_is_strictly_bound_to_its_organization(self) -> None:
        created = self._create(role="owner", scopes=["org:admin", "org:read"])
        other = self.create_organization(owner=self.user)

        denied = APIClient().get(
            f"/api/0/organizations/{other.slug}/projects/",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )
        assert denied.status_code == 403

    def test_service_account_cannot_enter_human_account_workflows(self) -> None:
        created = self._create(role="owner", scopes=["org:admin", "org:read"])

        with assume_test_silo_mode(SiloMode.CONTROL):
            response = APIClient().get(
                "/api/0/users/me/",
                HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
            )

        assert response.status_code == 403

    def test_service_account_can_manage_accounts_when_role_and_scope_allow_it(self) -> None:
        created = self._create(role="owner", scopes=["org:admin"])
        client = APIClient()
        with self.feature(FEATURE):
            response = client.post(
                self.url,
                data={
                    "name": "Nested bot",
                    "role": "member",
                    "scopes": ["org:read"],
                },
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
            )

        assert response.status_code == 201, response.content
        assert response.data["name"] == "Nested bot"
