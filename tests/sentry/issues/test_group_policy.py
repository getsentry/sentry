from dataclasses import dataclass
from itertools import cycle
from unittest.mock import patch

from sentry.issues.group_policy import (
    DEFAULT_EXPIRY_TIME,
    DEFAULT_IGNORE_LIMIT,
    GroupPolicy,
    NoiseConfig,
    _group_policy_registry,
    get_noise_config,
)
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    _group_type_registry,
    get_all_group_type_ids,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTypeTest(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.next_group_type = cycle(get_all_group_type_ids())

    def test_get_noise_config(self) -> None:
        with patch.dict(_group_policy_registry, {}, clear=True):

            @dataclass(frozen=True)
            class TestGroupPolicy1(GroupPolicy):
                group_type_id = next(self.next_group_type)
                limited_access = NoiseConfig(
                    ignore_limit=100,
                    expiry_time=60,
                )

            @dataclass(frozen=True)
            class TestGroupPolicy2(GroupPolicy):
                group_type_id = next(self.next_group_type)
                limited_access = NoiseConfig(
                    ignore_limit=10,
                    expiry_time=600,
                )

            # TODO uncomment these once the org level gets evaluated

            # noise_config_1 = get_noise_config(TestGroupPolicy1, self.org)
            # assert noise_config_1.ignore_limit == 100
            # assert noise_config_1.expiry_time == 60

            # noise_config_2 = get_noise_config(TestGroupPolicy2, self.org)
            # assert noise_config_2.ignore_limit == 10
            # assert noise_config_2.expiry_time == 600

    def test_default_noise_config(self) -> None:
        with patch.dict(_group_policy_registry, {}, clear=True):

            @dataclass(frozen=True)
            class TestGroupPolicy(GroupPolicy):
                group_type_id = next(self.next_group_type)

            noise_config = get_noise_config(TestGroupPolicy, self.org)
            assert noise_config.ignore_limit == DEFAULT_IGNORE_LIMIT
            assert noise_config.expiry_time == DEFAULT_EXPIRY_TIME

    def test_get_group_policy_lookup(self) -> None:
        with patch.dict(_group_type_registry, {}, clear=True), patch.dict(
            _group_policy_registry, {}, clear=True
        ):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "test"
                description = "Test"
                category = GroupCategory.ERROR.value
                ignore_limit = 0

            @dataclass(frozen=True)
            class TestGroupPolicy(GroupPolicy):
                group_type_id = next(self.next_group_type)
                limited_access = NoiseConfig(
                    ignore_limit=100,
                    expiry_time=60,
                )

            assert _group_policy_registry[TestGroupType.type_id] == TestGroupPolicy

    def test_invalid_group_types(self) -> None:
        with patch.dict(_group_type_registry, {}, clear=True), patch.dict(
            _group_policy_registry, {}, clear=True
        ):

            good_group_type_id, bad_group_type_id = 1, 2

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = good_group_type_id
                slug = "test"
                description = "Test"
                category = GroupCategory.ERROR.value
                ignore_limit = 0

            @dataclass(frozen=True)
            class TestGroupPolicy1(GroupPolicy):
                group_type_id = good_group_type_id

            with self.assertRaisesMessage(
                ValueError,
                f"No group type with the id {bad_group_type_id} is registered.",
            ):

                @dataclass(frozen=True)
                class TestGroupPolicy2(GroupPolicy):
                    group_type_id = bad_group_type_id

            with self.assertRaisesMessage(
                ValueError,
                f"A group policy for the group type {good_group_type_id} has already been registered.",
            ):

                @dataclass(frozen=True)
                class TestGroupPolicy3(GroupPolicy):
                    group_type_id = good_group_type_id

    def test_noise_config_validation(self) -> None:
        with patch.dict(_group_policy_registry, {}, clear=True):

            @dataclass(frozen=True)
            class TestGroupPolicy1(GroupPolicy):
                group_type_id = next(self.next_group_type)
                limited_access = NoiseConfig(
                    ignore_limit=100,
                )
                early_access = NoiseConfig(ignore_limit=50)

            @dataclass(frozen=True)
            class TestGroupPolicy2(GroupPolicy):
                group_type_id = next(self.next_group_type)
                early_access = NoiseConfig(ignore_limit=50)
                default = NoiseConfig(ignore_limit=10)

        with self.assertRaisesMessage(
            ValueError,
            "Early Access ignore limit must be greater than Limited Access ignore limit",
        ):
            TestGroupPolicy1(
                1,
                limited_access=NoiseConfig(
                    ignore_limit=100,
                ),
                early_access=NoiseConfig(ignore_limit=50),
            )

        with self.assertRaisesMessage(
            ValueError,
            "Default ignore limit must be greater than Early Access and Limited Access ignore limits",
        ):
            TestGroupPolicy2(
                1,
                limited_access=None,
                early_access=NoiseConfig(ignore_limit=50),
                default=NoiseConfig(ignore_limit=10),
            )
