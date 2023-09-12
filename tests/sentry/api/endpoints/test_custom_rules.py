from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from sentry.api.endpoints.custom_rules import RuleExistsError, _save_rule
from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.dynamic_sampling.rules.biases.custom_rule_bias import (
    SerializedRule,
    clen_expired_rules,
    custom_rules_redis_key,
    get_rule_hash,
    hash_value,
    rule_from_json,
)
from sentry.snuba.metrics.extraction import ComparingRuleCondition
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


def test_same_hash_value():
    """
    tests that the hash value returns the same value for equivalent objects

    """
    v1 = {
        "a": 1,
        "b": [3, 1, 2],
        "c": {"x": datetime(2020, 1, 1), "z": "abc", "y": ["a", "b", "c"]},
        "d": {},
        "e": [],
    }

    v2 = {
        "b": [1, 3, 2],
        "c": {"x": datetime(2020, 1, 1), "y": ["c", "a", "b"], "z": "abc"},
        "a": 1,
        "e": [],
        "d": {},
    }
    assert hash_value(v1) == hash_value(v2)


def test_different_hash_value():
    """
    tests that the hash value returns different values for different objects
    """
    v1 = {
        "a": {"b": ["x", "y", "z"]},
    }

    v2 = {
        "a": {"b": ["x", "y", "w"]},
    }
    assert hash_value(v1) != hash_value(v2)


@freeze_time("2023-09-11T10:00:00Z")
def test_save_expired_rule():
    """
    Test that we are not saving already expired rules
    """
    org_id = 1

    rule = SerializedRule(
        condition={"op": "eq", "name": "event.type", "value": "transaction"},
        expiration=(datetime.utcnow() - timedelta(minutes=1)).timestamp(),
        project_ids=[1, 2, 3],
        org_id=org_id,
    )

    redis_client = get_redis_client_for_ds()
    key = custom_rules_redis_key(org_id)

    # start with a clean slate
    redis_client.delete(key)

    with pytest.raises(ValueError):
        _save_rule(rule, True)

    # check that the rule was not saved
    rule = redis_client.hget(key, get_rule_hash(rule))
    assert rule is None


@freeze_time("2023-09-11T10:00:00Z")
@pytest.mark.parametrize("old_exists", [True, False])
@pytest.mark.parametrize("should_override", [True, False])
def test_save_rule(old_exists, should_override):

    condition: ComparingRuleCondition = {"op": "eq", "name": "event.type", "value": "transaction"}
    org_id = 1

    new_rule = SerializedRule(
        condition=condition,
        expiration=(datetime.utcnow() + timedelta(hours=1)).timestamp(),
        project_ids=[1, 2, 3],
        org_id=org_id,
    )

    old_rule = SerializedRule(
        condition=condition,
        expiration=(datetime.utcnow() + timedelta(minutes=1)).timestamp(),
        project_ids=[],
        org_id=org_id,
    )

    other_condition: ComparingRuleCondition = {"op": "eq", "name": "event.type", "value": "event"}

    some_other_rule = SerializedRule(
        condition=other_condition,  # something that should not be overridden
        expiration=(datetime.utcnow() + timedelta(minutes=30)).timestamp(),
        project_ids=[],
        org_id=org_id,
    )

    redis_client = get_redis_client_for_ds()
    key = custom_rules_redis_key(org_id)

    # start with a clean slate
    redis_client.delete(key)

    redis_client.hset(key, get_rule_hash(some_other_rule), json.dumps(some_other_rule))
    if old_exists:
        redis_client.hset(key, get_rule_hash(old_rule), json.dumps(old_rule))

    # check if the function should raise an error
    raises_error = old_exists and not should_override

    if raises_error:
        with pytest.raises(RuleExistsError):
            _save_rule(new_rule, should_override)
    else:
        _save_rule(new_rule, should_override)

    # check the function does what it should

    # it should not touch some other rule
    other_rule_str = redis_client.hget(key, get_rule_hash(some_other_rule))
    actual_other_rule = rule_from_json(other_rule_str)

    # keeps other rules
    assert actual_other_rule == some_other_rule

    actual_rule_str = redis_client.hget(key, get_rule_hash(new_rule))
    actual_rule = rule_from_json(actual_rule_str)

    if should_override or not old_exists:
        assert actual_rule == new_rule
    else:
        assert actual_rule == old_rule


def test_clean_expired_rules():
    """
    Test that rules that are expired are cleaned up from redis
    """
    org_id = 1
    condition: ComparingRuleCondition = {"op": "eq", "name": "event.type", "value": "transaction"}

    with freeze_time("2023-09-11T10:00:00Z") as frozen_time:
        old_rule = SerializedRule(
            condition=condition,
            expiration=(datetime.utcnow() + timedelta(minutes=1)).timestamp(),
            project_ids=[],
            org_id=org_id,
        )

        new_condition: ComparingRuleCondition = {"op": "eq", "name": "event.type", "value": "event"}
        new_rule = SerializedRule(
            condition=new_condition,  # something that should not be overridden
            expiration=(datetime.utcnow() + timedelta(minutes=30)).timestamp(),
            project_ids=[],
            org_id=org_id,
        )

        _save_rule(old_rule, True)
        _save_rule(new_rule, True)

        # expire the old rule go forward 2 minutes since the old rule expires in 1 minute from now
        frozen_time.tick(delta=timedelta(minutes=2))

        clen_expired_rules(org_id)

        redis_client = get_redis_client_for_ds()
        key = custom_rules_redis_key(org_id)

        # the new rule should still be there
        new_rule_str = redis_client.hget(key, get_rule_hash(new_rule))
        assert new_rule_str is not None

        # the old rule should be gone
        old_rule_str = redis_client.hget(key, get_rule_hash(old_rule))
        assert old_rule_str is None


@region_silo_test(stable=True)
class CustomRulesEndpoint(APITestCase):
    """
    Tests that calling the endpoint converts the query to a rule returns it and saves it in redis
    """

    endpoint = "sentry-api-0-organization-dynamic_sampling-custom_rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
            "period": "1d",
            "overrideExisting": True,
        }
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        data = resp.data

        # check we have the rule in redis
        redis_client = get_redis_client_for_ds()
        key = custom_rules_redis_key(self.organization.id)
        rule_str = redis_client.hget(key, get_rule_hash(data))
        rule = rule_from_json(rule_str)

        # returned rule is the same as the one in redis
        assert rule == data

    def test_checks_feature(self):
        """
        Checks request fails without the feature
        """
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
            "period": "1d",
            "overrideExisting": True,
        }
        with Feature({"organizations:investigation-bias": False}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 404
