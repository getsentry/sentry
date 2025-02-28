from unittest.mock import patch

from django.db.models import Q

import sentry.hybridcloud.rpc.caching as caching_module
from sentry.backup.dependencies import NormalizedModelName, dependencies, get_model_name
from sentry.db.models.base import Model
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleActivity
from sentry.incidents.models.incident import IncidentActivity
from sentry.models.activity import Activity
from sentry.models.authidentity import AuthIdentity
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.recentsearch import RecentSearch
from sentry.models.rule import Rule, RuleActivity
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.savedsearch import SavedSearch
from sentry.models.tombstone import RegionTombstone
from sentry.monitors.models import Monitor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.backups import BackupTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.types.region import Region, RegionCategory, find_regions_for_user
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from tests.sentry.backup import expect_models

_TEST_REGIONS = (
    Region("na", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT),
    Region("eu", 2, "http://na.testserver", RegionCategory.MULTI_TENANT),
)


@control_silo_test(regions=_TEST_REGIONS)
class UserHybridCloudDeletionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.user_id = self.user.id

        # Organization membership determines which regions the deletion will cascade to
        self.organization = self.create_organization(region=_TEST_REGIONS[0])
        self.create_member(user=self.user, organization=self.organization)

        self.create_saved_search(
            name="some-search", owner=self.user, organization=self.organization
        )

    @assume_test_silo_mode(SiloMode.REGION)
    def user_tombstone_exists(self, user_id: int) -> bool:
        return RegionTombstone.objects.filter(
            table_name="auth_user", object_identifier=user_id
        ).exists()

    @assume_test_silo_mode(SiloMode.REGION)
    def get_user_saved_search_count(self) -> int:
        return SavedSearch.objects.filter(owner_id=self.user_id).count()

    def test_simple(self):
        assert not self.user_tombstone_exists(user_id=self.user_id)
        with outbox_runner():
            self.user.delete()
        assert not User.objects.filter(id=self.user_id).exists()
        assert self.user_tombstone_exists(user_id=self.user_id)

        # cascade is asynchronous, ensure there is still related search,
        assert self.get_user_saved_search_count() == 1

        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        # Ensure they are all now gone.
        assert self.get_user_saved_search_count() == 0

    def test_unrelated_saved_search_is_not_deleted(self):
        another_user = self.create_user()
        self.create_member(user=another_user, organization=self.organization)
        self.create_saved_search(
            name="another-search", owner=another_user, organization=self.organization
        )

        with outbox_runner():
            self.user.delete()
        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        with assume_test_silo_mode(SiloMode.REGION):
            assert SavedSearch.objects.filter(owner_id=another_user.id).exists()

    def test_cascades_to_multiple_regions(self):
        eu_org = self.create_organization(region=_TEST_REGIONS[1])
        self.create_member(user=self.user, organization=eu_org)
        self.create_saved_search(name="eu-search", owner=self.user, organization=eu_org)

        with outbox_runner():
            self.user.delete()

        assert self.get_user_saved_search_count() == 2
        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
        assert self.get_user_saved_search_count() == 0

    def test_deletions_create_tombstones_in_regions_for_user_with_no_orgs(self):
        # Create a user with no org memberships
        user_to_delete = self.create_user("foo@example.com")
        user_id = user_to_delete.id
        with outbox_runner():
            user_to_delete.delete()

        assert self.user_tombstone_exists(user_id=user_id)

    def test_cascades_to_regions_even_if_user_ownership_revoked(self):
        eu_org = self.create_organization(region=_TEST_REGIONS[1])
        self.create_member(user=self.user, organization=eu_org)
        self.create_saved_search(name="eu-search", owner=self.user, organization=eu_org)
        assert self.get_user_saved_search_count() == 2

        with outbox_runner(), assume_test_silo_mode_of(OrganizationMember):
            for member in OrganizationMember.objects.filter(user_id=self.user.id):
                member.delete()

        assert find_regions_for_user(self.user.id) == set()

        with outbox_runner():
            self.user.delete()

        assert self.get_user_saved_search_count() == 2
        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
        assert self.get_user_saved_search_count() == 0

    def test_update_purge_region_cache(self):
        user = self.create_user()
        na_org = self.create_organization(region=_TEST_REGIONS[0])
        self.create_member(user=user, organization=na_org)

        with patch.object(caching_module, "region_caching_service") as mock_caching_service:
            user.username = "bob2"
            user.save()
            mock_caching_service.clear_key.assert_any_call(
                key=f"user_service.get_many_by_id:{user.id}",
                region_name=_TEST_REGIONS[0].name,
            )
            mock_caching_service.clear_key.assert_any_call(
                key=f"user_service.get_user:{user.id}",
                region_name=_TEST_REGIONS[0].name,
            )


@control_silo_test
class UserDetailsTest(TestCase):
    def test_get_full_name(self):
        user = self.create_user(name="foo bar")
        assert user.name == user.get_full_name() == "foo bar"

    def test_salutation(self):
        user = self.create_user(email="a@example.com", username="a@example.com")
        assert user.get_salutation_name() == "A"

        user.update(name="hello world", email="b@example.com")
        user = User.objects.get(id=user.id)
        assert user.name == "hello world"
        assert user.email == "b@example.com"
        assert user.get_salutation_name() == "Hello"


ORG_MEMBER_MERGE_TESTED: set[NormalizedModelName] = set()


@control_silo_test
class UserMergeToTest(BackupTestCase, HybridCloudTestMixin):
    def verify_model_existence_by_user(
        self, models: list[type[Model]], *, present: list[User], absent: list[User]
    ) -> None:
        for model in sorted(models, key=lambda x: get_model_name(x)):
            model_relations = dependencies()[get_model_name(model)]
            user_refs = [k for k, v in model_relations.foreign_keys.items() if v.model == User]
            is_region_model = SiloMode.REGION in model_relations.silos
            with assume_test_silo_mode(SiloMode.REGION if is_region_model else SiloMode.CONTROL):
                for present_user in present:
                    q = Q()
                    for ref in user_refs:
                        args = {}
                        args[f"{ref}"] = present_user.id
                        q |= Q(**args)
                    assert (
                        model.objects.filter(q).count() > 0
                    ), "There seems to be an issue with merging objects from one user to another. This can be fixed by adding the model to the model_list in merge_users() in src/sentry/organizations/services/organization/impl.py, which then takes care of merging objects that have a foreign key on the user_id. "
                for absent_user in absent:
                    q = Q()
                    for ref in user_refs:
                        args = {}
                        args[f"{ref}"] = absent_user.id
                        q |= Q(**args)
                    assert not model.objects.filter(q).exists()

    def test_simple(self):
        from_user = self.create_exhaustive_user("foo@example.com")
        self.create_exhaustive_api_keys_for_user(from_user)
        to_user = self.create_exhaustive_user("bar@example.com")
        self.create_exhaustive_api_keys_for_user(to_user)

        org = self.create_organization(name="simple-org")
        proj = self.create_project(name="simple-proj", organization=org)
        self.create_exhaustive_organization_auth(from_user, org, proj)

        Authenticator.objects.get(user=from_user, type=1)
        to_auth_dup = Authenticator.objects.get(user=to_user, type=1)
        from_auth_uniq = Authenticator.objects.create(user=from_user, type=2)
        to_auth_uniq = Authenticator.objects.create(user=to_user, type=3)

        from_user.merge_to(to_user)

        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(user_id=from_user.id).exists()
            for member in OrganizationMember.objects.filter(user_id=to_user.id):
                self.assert_org_member_mapping(org_member=member)

        assert UserEmail.objects.filter(
            user=to_user, email=to_user.email, is_verified=True
        ).exists()
        assert UserEmail.objects.filter(
            user=to_user, email=from_user.email, is_verified=True
        ).exists()

        # dupes shouldn't get merged.
        assert Authenticator.objects.filter(user=to_user, id=to_auth_dup.id).exists()
        assert Authenticator.objects.filter(user=to_user, id=from_auth_uniq.id).exists()
        assert Authenticator.objects.filter(user=to_user, id=to_auth_uniq.id).exists()

        assert AuthIdentity.objects.filter(user=to_user).count() == 1
        assert not AuthIdentity.objects.filter(user=from_user).exists()

    @expect_models(
        ORG_MEMBER_MERGE_TESTED,
        OrgAuthToken,
        OrganizationMember,
        OrganizationMemberMapping,
    )
    def test_duplicate_memberships(self, expected_models: list[type[Model]]):
        from_user = self.create_user("foo@example.com")
        to_user = self.create_user("bar@example.com")
        org_slug = "org-with-duplicate-members-being-merged"
        org = self.create_organization(name=org_slug)
        team_1 = self.create_team(organization=org)
        team_2 = self.create_team(organization=org)
        team_3 = self.create_team(organization=org)
        all_teams = [team_1, team_2, team_3]
        from_user_member = self.create_member(
            organization=org, user=from_user, role="owner", teams=[team_1, team_2]
        )

        # to_user should have less roles
        to_user_member = self.create_member(
            organization=org, user=to_user, role="member", teams=[team_2, team_3]
        )

        OrgAuthToken.objects.create(
            created_by=from_user,
            organization_id=org.id,
            name=f"token 1 for {org.slug}",
            token_hashed=f"ABCDEF{org.slug}{from_user.id}",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        OrgAuthToken.objects.create(
            created_by=to_user,
            organization_id=org.id,
            name=f"token 1 for {org.slug}",
            token_hashed=f"ABCDEF{org.slug}{to_user.id}",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        # Access requests should cancel out once users are merged.
        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationAccessRequest.objects.create(
                team=team_1, member=from_user_member, requester_id=to_user.id
            )
            OrganizationAccessRequest.objects.create(
                team=team_3, member=to_user_member, requester_id=from_user.id
            )
            assert OrganizationAccessRequest.objects.filter(team__in=all_teams).count() == 2

        self.verify_model_existence_by_user(
            expected_models, present=[from_user, to_user], absent=[]
        )
        with outbox_runner():
            from_user.merge_to(to_user)

        self.verify_model_existence_by_user(expected_models, present=[to_user], absent=[from_user])
        with assume_test_silo_mode(SiloMode.REGION):
            for member in OrganizationMember.objects.filter(user_id__in=[from_user.id, to_user.id]):
                self.assert_org_member_mapping(org_member=member)
            member = OrganizationMember.objects.get(user_id=to_user.id)

        assert member.role == "owner"
        assert list(member.teams.all().order_by("pk")) == all_teams

        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationAccessRequest.objects.filter(team__in=all_teams).exists()

    @expect_models(
        ORG_MEMBER_MERGE_TESTED,
        Activity,
        AlertRule,
        AlertRuleActivity,
        CustomDynamicSamplingRule,
        Dashboard,
        DashboardFavoriteUser,
        GroupAssignee,
        GroupBookmark,
        GroupSeen,
        GroupShare,
        GroupSearchView,
        GroupSearchViewStarred,
        GroupSubscription,
        IncidentActivity,
        Monitor,
        OrganizationAccessRequest,
        OrganizationMember,
        OrgAuthToken,
        ProjectBookmark,
        RecentSearch,
        Rule,
        RuleActivity,
        RuleSnooze,
        SavedSearch,
    )
    def test_only_source_user_is_member_of_organization(self, expected_models: list[type[Model]]):
        from_user = self.create_exhaustive_user("foo@example.com")
        to_user = self.create_exhaustive_user("bar@example.com")
        org_slug = "org-only-from-user-is-member-of"
        self.create_exhaustive_organization(
            slug=org_slug, owner=from_user, member=self.create_user("random@example.com")
        )

        self.verify_model_existence_by_user(expected_models, present=[from_user], absent=[to_user])
        with outbox_runner():
            from_user.merge_to(to_user)

        self.verify_model_existence_by_user(expected_models, present=[to_user], absent=[from_user])

    @expect_models(
        ORG_MEMBER_MERGE_TESTED,
        Activity,
        AlertRule,
        AlertRuleActivity,
        CustomDynamicSamplingRule,
        Dashboard,
        DashboardFavoriteUser,
        GroupAssignee,
        GroupBookmark,
        GroupSeen,
        GroupShare,
        GroupSearchView,
        GroupSearchViewStarred,
        GroupSubscription,
        IncidentActivity,
        Monitor,
        OrganizationAccessRequest,
        OrganizationMember,
        OrgAuthToken,
        ProjectBookmark,
        RecentSearch,
        Rule,
        RuleActivity,
        RuleSnooze,
        SavedSearch,
    )
    def test_both_users_are_members_of_organization(self, expected_models: list[type[Model]]):
        from_user = self.create_exhaustive_user("foo@example.com")
        to_user = self.create_exhaustive_user("bar@example.com")
        random_user = self.create_user("random@example.com")
        org_slug = "org-both-users-are-member-of"
        org = self.create_exhaustive_organization(
            slug=org_slug, owner=from_user, member=to_user, other_members=[random_user]
        )
        with assume_test_silo_mode(SiloMode.REGION):
            from_member = OrganizationMember.objects.get(organization=org, user_id=from_user.id)
            rand_member = OrganizationMember.objects.get(organization=org, user_id=random_user.id)
            team_1 = self.create_team(organization=org, members=[from_member])
            team_2 = self.create_team(organization=org, members=[rand_member])
            OrganizationAccessRequest.objects.create(
                member=from_member,
                team=team_1,
                requester_id=random_user.id,
            )
            OrganizationAccessRequest.objects.create(
                member=rand_member,
                team=team_2,
                requester_id=from_user.id,
            )

        self.verify_model_existence_by_user(expected_models, present=[from_user], absent=[])
        with outbox_runner():
            from_user.merge_to(to_user)

        self.verify_model_existence_by_user(expected_models, present=[to_user], absent=[from_user])

        with assume_test_silo_mode(SiloMode.REGION):
            to_member = OrganizationMember.objects.get(organization=org, user_id=to_user.id)
            assert OrganizationAccessRequest.objects.filter(
                member=to_member,
                requester_id=random_user.id,
            ).exists()
            assert OrganizationAccessRequest.objects.filter(
                requester_id=to_user.id,
            ).exists()
