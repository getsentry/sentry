import importlib
import uuid

import pytest

from sentry.testutils.cases import TestMigrations

migration = importlib.import_module("sentry.uptime.migrations.0055_backfill_2xx_status_assertion")
ensure_2xx_status_checks = migration.ensure_2xx_status_checks

GT_199 = {"op": "status_code_check", "operator": {"cmp": "greater_than"}, "value": 199}
LT_300 = {"op": "status_code_check", "operator": {"cmp": "less_than"}, "value": 300}


class TestEnsure2xxStatusChecks:
    def test_none_assertion(self) -> None:
        result, was_modified = ensure_2xx_status_checks(None)
        assert was_modified
        assert result == {"root": {"op": "and", "children": [GT_199, LT_300]}}

    def test_empty_dict(self) -> None:
        result, was_modified = ensure_2xx_status_checks({})
        assert was_modified
        assert result == {"root": {"op": "and", "children": [GT_199, LT_300]}}

    def test_already_has_status_code_check_at_root(self) -> None:
        assertion = {
            "root": {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 200}
        }
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert not was_modified
        assert result == assertion

    def test_already_has_status_code_check_nested_in_and(self) -> None:
        assertion = {
            "root": {
                "op": "and",
                "children": [
                    {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 200},
                    {
                        "op": "json_path",
                        "operator": {"cmp": "equals"},
                        "value": "$.status",
                        "operand": {"jsonpath_op": "literal", "value": "ok"},
                    },
                ],
            }
        }
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert not was_modified
        assert result == assertion

    def test_already_has_status_code_check_nested_in_or(self) -> None:
        assertion = {
            "root": {
                "op": "or",
                "children": [
                    {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 200},
                    {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 204},
                ],
            }
        }
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert not was_modified
        assert result == assertion

    def test_already_has_status_code_check_inside_not(self) -> None:
        assertion = {
            "root": {
                "op": "not",
                "operand": {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 404},
            }
        }
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert not was_modified
        assert result == assertion

    def test_already_has_status_code_check_deeply_nested(self) -> None:
        assertion = {
            "root": {
                "op": "and",
                "children": [
                    {
                        "op": "or",
                        "children": [
                            {
                                "op": "status_code_check",
                                "operator": {"cmp": "equals"},
                                "value": 200,
                            },
                            {
                                "op": "status_code_check",
                                "operator": {"cmp": "equals"},
                                "value": 204,
                            },
                        ],
                    }
                ],
            }
        }
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert not was_modified
        assert result == assertion

    def test_no_status_code_check_and_root(self) -> None:
        json_path_check = {
            "op": "json_path",
            "operator": {"cmp": "equals"},
            "value": "$.status",
            "operand": {"jsonpath_op": "literal", "value": "ok"},
        }
        assertion = {"root": {"op": "and", "children": [json_path_check]}}
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert was_modified
        assert result == {"root": {"op": "and", "children": [json_path_check, GT_199, LT_300]}}

    def test_no_status_code_check_non_and_root(self) -> None:
        json_path_check = {
            "op": "json_path",
            "operator": {"cmp": "equals"},
            "value": "$.status",
            "operand": {"jsonpath_op": "literal", "value": "ok"},
        }
        assertion = {"root": json_path_check}
        result, was_modified = ensure_2xx_status_checks(assertion)
        assert was_modified
        assert result == {"root": {"op": "and", "children": [json_path_check, GT_199, LT_300]}}


@pytest.mark.skip(reason="TestMigrations is slow; run explicitly")
class Backfill2xxStatusAssertionMigrationTest(TestMigrations):
    migrate_from = "0054_delete_bad_assertions"
    migrate_to = "0055_backfill_2xx_status_assertion"
    app = "uptime"

    def setup_initial_state(self) -> None:
        self.organization = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.organization)

        self.null_assertion_sub = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
        )

        self.existing_status_code_sub = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
            assertion={
                "root": {
                    "op": "and",
                    "children": [
                        {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 200}
                    ],
                }
            },
        )

        self.json_path_only_sub = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
            assertion={
                "root": {
                    "op": "and",
                    "children": [
                        {
                            "op": "json_path",
                            "operator": {"cmp": "equals"},
                            "value": "$.status",
                            "operand": {"jsonpath_op": "literal", "value": "ok"},
                        }
                    ],
                }
            },
        )

        self.non_and_root_sub = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
            assertion={
                "root": {
                    "op": "json_path",
                    "operator": {"cmp": "equals"},
                    "value": "$.status",
                    "operand": {"jsonpath_op": "literal", "value": "ok"},
                }
            },
        )

    def test_migration(self) -> None:
        # null assertion gets the default >199 AND <300 pair
        self.null_assertion_sub.refresh_from_db()
        assert self.null_assertion_sub.assertion == {
            "root": {"op": "and", "children": [GT_199, LT_300]}
        }

        # existing status_code_check is left untouched
        self.existing_status_code_sub.refresh_from_db()
        assert self.existing_status_code_sub.assertion == {
            "root": {
                "op": "and",
                "children": [
                    {"op": "status_code_check", "operator": {"cmp": "equals"}, "value": 200}
                ],
            }
        }

        # json_path only — pair appended, existing child preserved
        self.json_path_only_sub.refresh_from_db()
        assert self.json_path_only_sub.assertion == {
            "root": {
                "op": "and",
                "children": [
                    {
                        "op": "json_path",
                        "operator": {"cmp": "equals"},
                        "value": "$.status",
                        "operand": {"jsonpath_op": "literal", "value": "ok"},
                    },
                    GT_199,
                    LT_300,
                ],
            }
        }

        # non-and root — wrapped in a new and group
        self.non_and_root_sub.refresh_from_db()
        assert self.non_and_root_sub.assertion == {
            "root": {
                "op": "and",
                "children": [
                    {
                        "op": "json_path",
                        "operator": {"cmp": "equals"},
                        "value": "$.status",
                        "operand": {"jsonpath_op": "literal", "value": "ok"},
                    },
                    GT_199,
                    LT_300,
                ],
            }
        }
