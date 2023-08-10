"""Error_ids array visitors module.

This module demonstrates what's already present in other files but in a more direct and succinct
way.  The "SumOfErrorIdsArray" visitor composes the "ErrorIdsArray" visitor and asks if the
aggregated result "contains" or "does not contain" a matching value.
"""
from __future__ import annotations

from uuid import UUID

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.new_query.utils import contains, does_not_contain, to_uuid
from sentry.replays.usecases.query.conditions.base import ComputedBase


class ErrorIdsArray(ComputedBase):
    """Error ids array condition visitor."""

    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return Condition(has_error_id(value), Op.EQ, 1)

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return Condition(has_error_id(value), Op.EQ, 0)

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return Condition(has_any_error_id(value), Op.EQ, 1)

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return Condition(has_any_error_id(value), Op.EQ, 0)


class SumOfErrorIdsArray(ComputedBase):
    """Sum of error ids array condition visitor."""

    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return contains(ErrorIdsArray.visit_eq(value))

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return does_not_contain(ErrorIdsArray.visit_eq(value))

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return contains(ErrorIdsArray.visit_in(value))

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return does_not_contain(ErrorIdsArray.visit_in(value))


def has_error_id(error_id: UUID) -> Function:
    return Function(
        "has",
        parameters=[
            # Because this is an exact match operation we use the bloom filter index.
            Column("_error_ids_hashed"),
            Function("cityHash64", parameters=[to_uuid(error_id)]),
        ],
    )


def has_any_error_id(error_ids: list[UUID]) -> Function:
    return Function(
        "hasAny",
        parameters=[
            # Because this is an exact match operation we use the bloom filter index.
            Column("_error_ids_hashed"),
            [Function("cityHash64", parameters=[to_uuid(eid)]) for eid in error_ids],
        ],
    )
