from django.db import connections
from django.test.utils import CaptureQueriesContext

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.users.models.userpermission import UserPermission
from sentry.users.services.user.service import user_service


@all_silo_test
class UserServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()

    def test_user_serialize_avatar_none(self) -> None:
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar is None

    def test_user_serialize_avatar(self) -> None:
        avatar = self.create_user_avatar(user_id=self.user.id, avatar_type=2, ident="abc123")
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar
        assert rpc_user.avatar.id == avatar.id
        assert rpc_user.avatar.ident == avatar.ident
        assert rpc_user.avatar.avatar_type == "gravatar"

    def test_user_serialize_multiple_emails(self) -> None:
        email = self.create_useremail(user=self.user, email="test@example.com", is_verified=True)
        unverified_email = self.create_useremail(
            user=self.user, email="nope@example.com", is_verified=False
        )

        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert len(rpc_user.emails) == 2
        assert rpc_user.emails == {email.email, self.user.email}

        assert len(rpc_user.useremails) == 3
        expected = {self.user.email, email.email, unverified_email.email}
        assert expected == {e.email for e in rpc_user.useremails}

    def test_get_many_profiles(self) -> None:
        users = [self.create_user() for _ in range(2)]
        target_ids = [users[0].id]
        profiles = user_service.get_many_profiles(filter=dict(user_ids=target_ids))
        assert len(profiles) == 1
        assert profiles[0].id == users[0].id

    def test_get_many_by_id(self) -> None:
        users = [self.create_user() for _ in range(2)]
        target_ids = [users[0].id]
        result = user_service.get_many_by_id(ids=target_ids)

        assert len(result) == 1
        assert result[0].id == users[0].id

        result = user_service.get_many_by_id(ids=target_ids)
        result_two = user_service.get_many_by_id(ids=target_ids)
        assert result == result_two

    def test_add_permission(self) -> None:
        # Test adding a new permission
        created = user_service.add_permission(user_id=self.user.id, permission="superuser.write")
        assert created is True

        # Verify permission was created
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        # Test adding the same permission again returns False
        created = user_service.add_permission(user_id=self.user.id, permission="superuser.write")
        assert created is False

    def test_serialize_many_avoids_correlated_subqueries(self) -> None:
        """base_query() eagerly loads data via correlated subqueries for the
        get_many/serialize_rpc path. serialize_many should not pay for these
        since the API serializer re-fetches what it needs in get_attrs()."""
        with assume_test_silo_mode(SiloMode.CONTROL):
            user_service.serialize_many(filter={"user_ids": [self.user.id]})

            with CaptureQueriesContext(connections["control"]) as ctx:
                user_service.serialize_many(filter={"user_ids": [self.user.id]})

            all_sql = " ".join(q["sql"] for q in ctx.captured_queries)
            assert "array_agg" not in all_sql

    def test_remove_permission(self) -> None:
        # Create a permission first
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserPermission.objects.create(user_id=self.user.id, permission="superuser.write")

        # Test removing existing permission
        removed = user_service.remove_permission(user_id=self.user.id, permission="superuser.write")
        assert removed is True

        # Verify permission was removed
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserPermission.objects.filter(
                user_id=self.user.id, permission="superuser.write"
            ).exists()

        # Test removing non-existent permission returns False
        removed = user_service.remove_permission(user_id=self.user.id, permission="superuser.write")
        assert removed is False


@all_silo_test
class ResolveFuzzyUserTest(TestCase):
    def _member(self, *, email: str, name: str = "", username: str | None = None, **kwargs):
        user = self.create_user(email=email, name=name, username=username or email, **kwargs)
        self.create_member(user=user, organization=self.organization)
        return user

    def _resolve(self, **kwargs) -> int | None:
        return user_service.resolve_fuzzy_user(organization_id=self.organization.id, **kwargs)

    def test_exact_email(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="dana.reed@sentry.io") == dana.id

    def test_exact_unverified_email(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        self.create_useremail(user=dana, email="dana.reed@gmail.com", is_verified=False)
        assert self._resolve(email="dana.reed@gmail.com") == dana.id

    def test_local_part_on_other_domain(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="dana.reed@gmail.com") == dana.id

    def test_normalized_local_part(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="dana_reed@gmail.com") == dana.id

    def test_does_not_allow_separators_inside_a_chunk(self) -> None:
        self._member(email="d.a.n.a@sentry.io", name="Other", username="other")
        assert self._resolve(email="dana@gmail.com") is None

    def test_name_from_dotted_local_part(self) -> None:
        dana = self._member(email="other@sentry.io", name="Dana Reed", username="dreed")
        assert self._resolve(email="dana.reed@gmail.com") == dana.id

    def test_explicit_name(self) -> None:
        dana = self._member(email="other@sentry.io", name="Dana Reed", username="dreed")
        assert self._resolve(name="Dana Reed") == dana.id

    def test_name_allows_middle_name(self) -> None:
        john = self._member(email="other@sentry.io", name="John Grant Smith", username="jsmith")
        assert self._resolve(name="John Smith") == john.id

    def test_middle_initial_is_optional(self) -> None:
        john = self._member(email="other@sentry.io", name="John Smith", username="jsmith")
        assert self._resolve(name="John G Smith") == john.id

    def test_middle_initial_does_not_match_another_initial(self) -> None:
        self._member(email="other@sentry.io", name="John Q Smith", username="jsmith")
        assert self._resolve(name="John G Smith") is None

    def test_github_noreply(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="12345+dana@users.noreply.github.com") == dana.id

    def test_github_noreply_without_plus(self) -> None:
        dana = self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="dana@users.noreply.github.com") == dana.id

    def test_username_variant_from_email(self) -> None:
        dana = self._member(email="other@sentry.io", name="Other", username="dana-reed")
        assert self._resolve(email="dana.reed@gmail.com") == dana.id

    def test_ambiguous_local_part(self) -> None:
        self._member(email="alice@sentry.io", name="Alice One", username="alice1")
        self._member(email="alice@contractor.io", name="Alice Two", username="alice2")
        assert self._resolve(email="alice@gmail.com") is None

    def test_ambiguous_name(self) -> None:
        self._member(email="j1@sentry.io", name="John Smith", username="jsmith1")
        self._member(email="j2@sentry.io", name="John Smith", username="jsmith2")
        assert self._resolve(name="John Smith") is None

    def test_exact_email_does_not_break_ambiguous_local_part(self) -> None:
        self._member(email="alice@gmail.com", name="Alice Gmail", username="alice-gmail")
        self._member(email="alice@sentry.io", name="Alice Work", username="alice-work")
        assert self._resolve(email="alice@gmail.com") is None

    def test_name_and_local_part_disagree(self) -> None:
        self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        self._member(email="other@sentry.io", name="Sam Okafor", username="sam")
        assert self._resolve(email="sam@gmail.com", name="Dana Reed") is None

    def test_outside_org_is_ignored(self) -> None:
        outsider = self.create_user(
            email="dana.reed@sentry.io", name="Dana Reed", username="dana-out"
        )
        self.create_member(user=outsider, organization=self.create_organization())
        assert self._resolve(email="dana.reed@gmail.com") is None

    def test_inactive_user_is_ignored(self) -> None:
        self._member(
            email="dana.reed@sentry.io", name="Dana Reed", username="dana", is_active=False
        )
        assert self._resolve(email="dana.reed@gmail.com") is None

    def test_short_local_part_matches(self) -> None:
        abe = self._member(email="ab@sentry.io", name="Abe", username="abe")
        assert self._resolve(email="ab@gmail.com") == abe.id

    def test_no_hints(self) -> None:
        assert self._resolve() is None

    def test_unknown_person(self) -> None:
        self._member(email="dana.reed@sentry.io", name="Dana Reed", username="dana")
        assert self._resolve(email="nobody@gmail.com") is None
