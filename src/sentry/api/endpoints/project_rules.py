import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule
from sentry.workflow_engine.utils.legacy_metric_tracking import (
    report_used_legacy_models,
)

logger = logging.getLogger(__name__)


def clean_rule_data(data):
    for datum in data:
        if datum.get("name"):
            del datum["name"]


@receiver(pre_save, sender=Rule)
def pre_save_rule(instance, sender, *args, **kwargs):
    clean_rule_data(instance.data.get("conditions", []))
    clean_rule_data(instance.data.get("actions", []))


@dataclass
class MatcherResult:
    has_key: bool = False
    key_matches: bool = False


class DuplicateRuleEvaluator:
    ACTIONS_KEY = "actions"
    ENVIRONMENT_KEY = "environment"
    SPECIAL_FIELDS = [ACTIONS_KEY, ENVIRONMENT_KEY]

    EXCLUDED_FIELDS = ["name", "user_id"]

    def __init__(
        self,
        project_id: int,
        rule_data: dict[Any, Any] | None = None,
        rule_id: int | None = None,
        rule: Rule | None = None,
    ) -> None:
        """
        rule.data will supersede rule_data if passed in
        """
        self._project_id = project_id
        self._rule_data = rule.data if rule else rule_data or {}
        self._rule_id = rule_id
        self._rule = rule

        self._keys_to_check = self._get_keys_to_check()

        self._matcher_funcs_by_key: dict[str, Callable[[Rule, str], MatcherResult]] = {
            self.ENVIRONMENT_KEY: self._environment_matcher,
            self.ACTIONS_KEY: self._actions_matcher,
        }

    def _get_keys_to_check(self) -> set[str]:
        """
        Returns a set of keys that should be checked against all existing rules.
        Some keys are ignored as they are not part of the logic.
        Some keys are required to check, and are added on top.
        """
        keys_to_check = {key for key in self._rule_data if key not in self.EXCLUDED_FIELDS}
        keys_to_check.update(self.SPECIAL_FIELDS)

        return keys_to_check

    def _get_func_to_call(self, key_to_check: str) -> Callable:
        return self._matcher_funcs_by_key.get(key_to_check, self._default_matcher)

    def _default_matcher(self, existing_rule: Rule, key_to_check: str) -> MatcherResult:
        """
        Default function that checks if the key exists in both rules for comparison, and compares the values.
        """
        match_results = MatcherResult()

        existing_rule_key_data = existing_rule.data.get(key_to_check)
        current_rule_key_data = self._rule_data.get(key_to_check)
        if existing_rule_key_data and current_rule_key_data:
            match_results.has_key = True

        if match_results.has_key:
            match_results.key_matches = existing_rule_key_data == current_rule_key_data
        return match_results

    def _environment_matcher(self, existing_rule: Rule, key_to_check: str) -> MatcherResult:
        """
        Special function that checks if the environments are the same.
        """

        # Do the default check to see if both rules have the same environment key, and if they do, use the result.
        if (
            base_result := self._default_matcher(existing_rule, key_to_check)
        ) and base_result.has_key:
            return base_result

        # Otherwise, we need to do the special checking for keys
        match_results = MatcherResult()
        if self._rule:
            if existing_rule.environment_id and self._rule.environment_id:
                # If the existing rule and our rule both have environment ids, check if it's the same
                match_results.has_key = True
                match_results.key_matches = (
                    existing_rule.environment_id == self._rule.environment_id
                )
            elif (
                existing_rule.environment_id
                and not self._rule.environment_id
                or not existing_rule.environment_id
                and self._rule.environment_id
            ):
                # Otherwise, if one of the rules has an environment key, but the other does not, the key was checked,
                # but it is obviously not the same anymore
                match_results.has_key = True
        else:
            current_rule_key_data = self._rule_data.get(key_to_check)
            if existing_rule.environment_id and current_rule_key_data:
                match_results.has_key = True
                match_results.key_matches = existing_rule.environment_id == current_rule_key_data
            elif (
                existing_rule.environment_id
                and not current_rule_key_data
                or not existing_rule.environment_id
                and current_rule_key_data
            ):
                match_results.has_key = True

        return match_results

    def _actions_matcher(self, existing_rule: Rule, key_to_check: str) -> MatcherResult:
        """
        Special function that checks if the actions are the same against a rule.
        """
        match_results = MatcherResult()

        existing_actions = existing_rule.data.get(key_to_check)
        current_actions = self._rule_data.get(key_to_check)
        if not existing_actions and not current_actions:
            return match_results

        # At this point, either both have the key, or one of the rules has the key, so this has to be true
        match_results.has_key = True
        # Only compare if both have the key
        if existing_actions and current_actions:
            match_results.key_matches = self._compare_lists_of_dicts(
                keys_to_ignore=["uuid"], list1=existing_actions, list2=current_actions
            )

        return match_results

    @classmethod
    def _compare_lists_of_dicts(
        cls,
        keys_to_ignore: list[str],
        list1: list[dict[Any, Any]] | None = None,
        list2: list[dict[Any, Any]] | None = None,
    ) -> bool:
        if list1 is None or list2 is None:
            return False

        if len(list1) != len(list2):
            return False

        for i, left in enumerate(list1):
            right = list2[i]
            raw_left = {k: v for k, v in left.items() if k not in keys_to_ignore}
            raw_right = {k: v for k, v in right.items() if k not in keys_to_ignore}

            # TODO (Yash): This code commented below is the corrected logic which accounts for bad key values.
            # clean_left = cls._get_clean_actions_dict(raw_left)
            # clean_right = cls._get_clean_actions_dict(raw_right)
            # if clean_left != clean_right:
            #     return False
            """
            This is a bug in the current logic.
            When comparing DB values to serialized values, the values that are `None` are not properly converted to
            empty strings.
            This means we end up incorrectly evaluating the actions aren't the same, when they actually are.
            """
            if raw_left != raw_right:
                return False

        return True

    @classmethod
    def _get_clean_actions_dict(cls, actions_dict: dict[Any, Any]) -> dict[Any, Any]:
        """
        Returns a dictionary where None is substituted with empty string to help compare DB values vs serialized values
        """
        cleaned_dict = {}
        for k, v in actions_dict.items():
            cleaned_dict[k] = "" if v is None else v

        return cleaned_dict

    def find_duplicate(self) -> Rule | None:
        """
        Determines whether specified rule already exists, and if it does, returns it.
        """
        if self._rule_id is None:
            all_rules = Rule.objects.all()
        else:
            all_rules = Rule.objects.exclude(id=self._rule_id)

        existing_rules = all_rules.filter(project__id=self._project_id, status=ObjectStatus.ACTIVE)
        # Mark that we're using legacy Rule models (even if query returns no results)
        report_used_legacy_models()

        for existing_rule in existing_rules:
            keys_checked = 0
            keys_matched = 0
            for key_to_check in self._keys_to_check:
                func = self._get_func_to_call(key_to_check=key_to_check)
                results: MatcherResult = func(
                    existing_rule=existing_rule, key_to_check=key_to_check
                )
                if results.has_key:
                    keys_checked += 1
                    if results.key_matches:
                        keys_matched += 1

            if keys_checked > 0 and keys_checked == keys_matched:
                return existing_rule

        return None


def find_duplicate_rule(project, rule_data=None, rule_id=None, rule=None):
    """
    TODO(Yash): Refactor to remove this function, but for now keep it as a catch all for all existing flows.
    """
    evaluator = DuplicateRuleEvaluator(
        project_id=project.id,
        rule_data=rule_data,
        rule_id=rule_id,
        rule=rule,
    )
    return evaluator.find_duplicate()


def get_max_alerts(project, kind: Literal["slow", "fast"]) -> int:
    if kind == "slow":
        if features.has("organizations:more-slow-alerts", project.organization):
            return settings.MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS

        return settings.MAX_SLOW_CONDITION_ISSUE_ALERTS

    has_more_fast_alerts = features.has("organizations:more-fast-alerts", project.organization)

    if has_more_fast_alerts:
        return settings.MAX_MORE_FAST_CONDITION_ISSUE_ALERTS

    return settings.MAX_FAST_CONDITION_ISSUE_ALERTS
