from unittest import mock

import pytest
from django.apps import apps
from django.db.models import Count, Field, Q

from sentry.constants import ObjectStatus
from sentry.db.models.scoped_lookups import (
    ScopedLookup,
    ScopedLookupError,
    _validated,
    check_query,
    scoped_lookups,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from tools.flake8_plugin import S025_SCOPED_LOOKUPS


def violations(queryset) -> list[tuple[str, str]]:
    return [(v.model.__name__, v.column) for v in check_query(queryset.query)]


class RepositoryRulesTest(TestCase):
    def test_external_id_alone(self) -> None:
        qs = Repository.objects.filter(organization_id=1, external_id="1")
        assert violations(qs) == [("Repository", "external_id")]

    def test_provider_scopes(self) -> None:
        assert violations(Repository.objects.filter(external_id="1", provider="x")) == []

    def test_integration_substitutes_for_provider(self) -> None:
        # The shape of PullRequest.objects.for_provider_pr: cross-org on purpose.
        qs = Repository.objects.exclude(status=ObjectStatus.HIDDEN).filter(
            external_id="1", integration_id=1
        )
        assert violations(qs) == []

    def test_primary_key_pins_the_row(self) -> None:
        inner = Repository.objects.filter(provider="x", organization_id=1).values("id")
        assert violations(Repository.objects.filter(id__in=inner, external_id="1")) == []

    def test_provider_in_every_or_branch_counts(self) -> None:
        qs = Repository.objects.filter(
            Repository.objects.provider_match("github"), organization_id=1, external_id="1"
        )
        assert violations(qs) == []

    def test_provider_in_one_or_branch_does_not_count(self) -> None:
        qs = Repository.objects.filter(Q(external_id="1") | Q(provider="x"))
        assert violations(qs) == [("Repository", "external_id")]

    def test_negation_and_null_tests_are_not_lookups(self) -> None:
        qs = Repository.objects.filter(external_id__isnull=False).exclude(external_id="")
        assert violations(qs) == []

    def test_null_provider_is_a_namespace(self) -> None:
        # Plugin-era rows have no provider; `provider=None` selects exactly that namespace.
        assert violations(Repository.objects.filter(external_id="1", provider=None)) == []
        assert violations(Repository.objects.filter(external_id="1", provider__isnull=False)) == [
            ("Repository", "external_id")
        ]

    def test_chained_filters_compose(self) -> None:
        qs = Repository.objects.filter(external_id="1").filter(provider__in=["x", "y"])
        assert violations(qs) == []
        assert violations(qs.values_list("id", flat=True)) == []

    def test_subquery_is_checked(self) -> None:
        inner = Repository.objects.filter(external_id="1").values("id")
        assert violations(Repository.objects.filter(id__in=inner)) == [
            ("Repository", "external_id")
        ]

    def test_unrelated_model_is_ignored(self) -> None:
        assert violations(Commit.objects.filter(key="a")) == []


@control_silo_test
class IdentityRulesTest(TestCase):
    def test_external_id_alone(self) -> None:
        assert violations(Identity.objects.filter(external_id="U1")) == [
            ("Identity", "external_id")
        ]

    def test_idp_by_name_or_attname(self) -> None:
        assert violations(Identity.objects.filter(external_id="U1", idp_id=1)) == []
        assert violations(Identity.objects.filter(external_id="U1", idp__in=[1, 2])) == []

    def test_idp_type_substitutes(self) -> None:
        qs = Identity.objects.filter(idp__type="google", external_id="sub")
        assert violations(qs) == []

    def test_join_pinned_by_its_unique_key(self) -> None:
        qs = Identity.objects.filter(external_id="U1", idp__type="slack", idp__external_id="T1")
        assert violations(qs) == []

    def test_user_does_not_scope_external_id(self) -> None:
        # (idp, user) is unique too, but it is not the key that contains external_id.
        assert violations(Identity.objects.filter(external_id="U1", user_id=1)) == [
            ("Identity", "external_id")
        ]

    def test_delete_identity_shape(self) -> None:
        qs = Identity.objects.filter(Q(external_id="U1") | Q(user_id=1), idp_id=1)
        assert violations(qs) == []


@control_silo_test
class JoinedIntegrationRulesTest(TestCase):
    def test_joined_external_id_needs_joined_provider(self) -> None:
        qs = OrganizationIntegration.objects.filter(integration__external_id="1")
        assert violations(qs) == [("Integration", "external_id")]
        qs = qs.filter(integration__provider="github")
        assert violations(qs) == []


class DeclarationsTest(TestCase):
    def test_every_enrolled_model_declares_a_valid_namespace(self) -> None:
        enrolled = [m for m in apps.get_models() if scoped_lookups(m)]
        assert {m.__name__ for m in enrolled} >= {"Repository", "Integration", "Identity"}

    def test_namespace_must_be_part_of_a_unique_key(self) -> None:
        with pytest.raises(TypeError, match="not part of any unique key"):
            _validated(Repository, "external_id", ScopedLookup(requires=("name",)))

    def test_namespace_must_not_be_empty(self) -> None:
        with pytest.raises(TypeError, match="at least one"):
            _validated(Repository, "external_id", ScopedLookup(requires=()))

    def test_substitute_must_target_a_required_column(self) -> None:
        with pytest.raises(TypeError, match="does not require"):
            _validated(
                Integration,
                "external_id",
                ScopedLookup(requires=("provider",), substitutes={"name": ("id",)}),
            )

    def test_flake8_table_matches_models(self) -> None:
        """tools/flake8_plugin.py cannot import Django, so it carries a copy of the rules."""
        expected: dict[str, dict[str, dict[str, tuple[str, ...]]]] = {}
        for model in apps.get_models():
            rules = scoped_lookups(model)
            if not rules:
                continue
            name = f"{model.__module__}.{model.__qualname__}"
            expected[name] = {}
            for column, rule in rules.items():
                expected[name][column] = {}
                for required in rule.requires:
                    field = model._meta.get_field(required)
                    assert isinstance(field, Field)
                    accepted = [required]
                    if field.attname != field.name:
                        accepted.append(field.attname)
                    accepted.extend(rule.substitutes.get(required, ()))
                    expected[name][column][required] = tuple(accepted)
        assert S025_SCOPED_LOOKUPS == expected


def _from_production_code():
    """Make the guard treat the calling test as production code."""
    return mock.patch("sentry.db.models.scoped_lookups._is_test_path", return_value=False)


class ScopedLookupEnforcementTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", external_id="1"
        )

    def test_queries_a_test_writes_are_exempt(self) -> None:
        assert list(Repository.objects.filter(external_id="1")) == [self.repo]

    def test_every_terminal_operation_is_guarded(self) -> None:
        unscoped = Repository.objects.filter(external_id="1")
        operations = [
            lambda: list(unscoped),
            lambda: unscoped.count(),
            lambda: unscoped.exists(),
            lambda: unscoped.first(),
            lambda: unscoped.get(),
            lambda: list(unscoped.iterator()),
            lambda: unscoped.aggregate(Count("id")),
            lambda: unscoped.update(name="renamed"),
            lambda: unscoped.delete(),
        ]
        with _from_production_code():
            for operation in operations:
                with pytest.raises(ScopedLookupError, match="Repository.external_id"):
                    operation()

    def test_scoped_query_passes(self) -> None:
        with _from_production_code():
            assert Repository.objects.get(external_id="1", provider="integrations:github")

    def test_unscoped_lookup_opts_out_and_survives_chaining(self) -> None:
        with _from_production_code():
            qs = Repository.objects.filter(external_id="1").unscoped_lookup(reason="test")
            assert list(qs.filter(status=ObjectStatus.ACTIVE)) == [self.repo]

    def test_unscoped_lookup_needs_a_reason(self) -> None:
        with pytest.raises(ValueError):
            Repository.objects.all().unscoped_lookup(reason="")

    def test_production_counts_instead_of_raising(self) -> None:
        with (
            _from_production_code(),
            mock.patch("sentry.utils.env.in_test_environment", return_value=False),
            mock.patch("sentry.utils.metrics.incr") as incr,
        ):
            assert list(Repository.objects.filter(external_id="1")) == [self.repo]
        incr.assert_called_once_with(
            "db.scoped_lookup.violation",
            tags={"model": "sentry.repository", "column": "external_id"},
            sample_rate=1.0,
        )


@control_silo_test
class ScopedLookupControlModelsTest(TestCase):
    def test_identity_lookup_is_guarded(self) -> None:
        idp = self.create_identity_provider(type="slack", external_id="T1")
        self.create_identity(user=self.user, identity_provider=idp, external_id="U1")
        with _from_production_code():
            with pytest.raises(ScopedLookupError, match="Identity.external_id"):
                Identity.objects.get(external_id="U1")
            assert Identity.objects.get(external_id="U1", idp__type="slack")
