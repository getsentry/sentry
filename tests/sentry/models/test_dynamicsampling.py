from datetime import datetime, timedelta
from typing import List, Optional, Set

import pytest
from django.utils import timezone

from sentry.models.dynamicsampling import (
    MAX_CUSTOM_RULES_PER_PROJECT,
    CustomDynamicSamplingRule,
    TooManyRules,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


def _create_rule_for_env(
    env_idx: int, projects: List[Project], organization: Organization
) -> CustomDynamicSamplingRule:
    condition = {"op": "equals", "name": "environment", "value": f"prod{env_idx}"}
    return CustomDynamicSamplingRule.update_or_create(
        condition=condition,
        start=timezone.now(),
        end=timezone.now() + timedelta(hours=1),
        project_ids=[project.id for project in projects],
        organization_id=organization.id,
        num_samples=100,
        sample_rate=0.5,
        query=f"environment:prod{env_idx}",
    )


@freeze_time("2023-09-18")
@region_silo_test()
class TestCustomDynamicSamplingRuleProject(TestCase):
    def setUp(self):
        super().setUp()
        self.second_project = self.create_project()
        self.second_organization = self.create_organization(owner=self.user)
        self.third_project = self.create_project(organization=self.second_organization)

    def test_update_or_create(self):
        condition = {"op": "equals", "name": "environment", "value": "prod"}

        end1 = timezone.now() + timedelta(hours=1)

        rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=timezone.now(),
            end=end1,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )

        end2 = timezone.now() + timedelta(hours=1)
        updated_rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=timezone.now() + timedelta(minutes=1),
            end=end2,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )

        assert rule.id == updated_rule.id
        projects = updated_rule.projects.all()

        assert len(projects) == 1
        assert self.project in projects

        assert updated_rule.end_date >= end1
        assert updated_rule.end_date >= end2

    def test_assign_rule_id(self):

        rule_ids = set()
        rules = []
        for idx in range(3):
            rule = _create_rule_for_env(idx, [self.project], self.organization)
            rule_ids.add(rule.rule_id)
            rules.append(rule)

        # all 3 rules have different rule ids
        assert len(rule_ids) == 3

        # make a rule obsolete and check that the rule id is reused
        rules[1].is_active = False
        rules[1].save()

        new_rule = _create_rule_for_env(4, [self.project], self.organization)
        assert new_rule.rule_id == rules[1].rule_id

        # a new rule will take another slot (now that there is no free slot)
        new_rule_2 = _create_rule_for_env(5, [self.project], self.organization)
        assert new_rule_2.rule_id not in rule_ids

        # make again an empty slot ( this time by having the rule expire)
        rules[2].start_date = timezone.now() - timedelta(hours=2)
        rules[2].end_date = timezone.now() - timedelta(hours=1)
        rules[2].save()

        # the new rule should take the empty slot
        new_rule_3 = _create_rule_for_env(6, [self.project], self.organization)
        assert new_rule_3.rule_id == rules[2].rule_id

    def test_deactivate_old_rules(self):
        idx = 1

        old_rules = []
        new_rules = []

        def create_rule(is_old: bool, idx: int):
            condition = {"op": "equals", "name": "environment", "value": f"prod{idx}"}
            if is_old:
                end_delta = -timedelta(hours=1)
            else:
                end_delta = timedelta(hours=1)
            return CustomDynamicSamplingRule.update_or_create(
                condition=condition,
                start=timezone.now() - timedelta(hours=2),
                end=timezone.now() + end_delta,
                project_ids=[self.project.id],
                organization_id=self.organization.id,
                num_samples=100,
                sample_rate=0.5,
                query=f"environment:prod{idx}",
            )

        for i in range(10):
            for is_old in [True, False]:
                idx += 1
                rule = create_rule(is_old, idx)
                if is_old:
                    old_rules.append(rule)
                else:
                    new_rules.append(rule)

        CustomDynamicSamplingRule.deactivate_old_rules()

        # check that all old rules are inactive and all new rules are active
        inactive_rules = list(CustomDynamicSamplingRule.objects.filter(is_active=False))
        assert len(inactive_rules) == 10
        for rule in old_rules:
            assert rule in inactive_rules

        active_rules = list(CustomDynamicSamplingRule.objects.filter(is_active=True))
        assert len(active_rules) == 10
        for rule in new_rules:
            assert rule in active_rules

    def test_get_rule_for_org(self):
        """
        Test the get_rule_for_org method
        """
        condition = {"op": "equals", "name": "environment", "value": "prod"}

        # check empty result
        rule = CustomDynamicSamplingRule.get_rule_for_org(
            condition, self.organization.id, [self.project.id]
        )
        assert rule is None

        new_rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=timezone.now() - timedelta(hours=2),
            end=timezone.now() + timedelta(hours=1),
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )

        rule = CustomDynamicSamplingRule.get_rule_for_org(
            condition, self.organization.id, [self.project.id]
        )
        assert rule == new_rule

    def test_get_project_rules(self):
        """
        Tests that all valid rules (i.e. active and within the date range) that apply to a project
        (i.e. that are either organization rules or apply to the project) are returned.
        """

        idx = [1]

        def create_rule(
            project_ids: List[int],
            org_id: Optional[int] = None,
            old: bool = False,
            new: bool = False,
        ) -> CustomDynamicSamplingRule:
            idx[0] += 1
            condition = {"op": "equals", "name": "environment", "value": f"prod{idx[0]}"}
            if old:
                end_delta = -timedelta(hours=2)
            else:
                end_delta = timedelta(hours=2)

            if new:
                start_delta = timedelta(hours=1)
            else:
                start_delta = -timedelta(hours=1)

            if org_id is None:
                org_id = self.organization.id

            return CustomDynamicSamplingRule.update_or_create(
                condition=condition,
                start=timezone.now() + start_delta,
                end=timezone.now() + end_delta,
                project_ids=project_ids,
                organization_id=org_id,
                num_samples=100,
                sample_rate=0.5,
                query=f"environment:prod{idx[0]}",
            )

        valid_project_rule = create_rule([self.project.id, self.second_project.id])
        valid_org_rule = create_rule([])
        # rule for another project
        create_rule([self.second_project.id])
        # rule for another org
        create_rule([self.third_project.id], org_id=self.second_organization.id)
        # old project rule ( already expired)
        create_rule([self.project.id], old=True)
        # new project rule ( not yet active)
        create_rule([self.project.id], new=True)
        # old org rule
        create_rule([], old=True)
        # new org rule
        create_rule([], new=True)

        # we should only get valid_project_rule and valid_org_rule
        rules = list(CustomDynamicSamplingRule.get_project_rules(self.project))
        assert len(rules) == 2
        assert valid_project_rule in rules
        assert valid_org_rule in rules

    def test_separate_projects_create_different_rules(self):
        """
        Tests that same condition for different projects create different rules
        """
        condition = {"op": "equals", "name": "environment", "value": "prod"}

        end1 = timezone.now() + timedelta(hours=1)

        rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=timezone.now(),
            end=end1,
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )

        end2 = timezone.now() + timedelta(hours=1)
        second_rule = CustomDynamicSamplingRule.update_or_create(
            condition=condition,
            start=timezone.now() + timedelta(minutes=1),
            end=end2,
            project_ids=[self.second_project.id],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )

        assert rule.id != second_rule.id

        first_projects = rule.projects.all()
        assert len(first_projects) == 1
        assert self.project == first_projects[0]

        second_projects = second_rule.projects.all()
        assert len(second_projects) == 1
        assert self.second_project == second_projects[0]

    def test_deactivate_expired_rules(self):
        """
        Tests that expired, and only expired, rules are deactivated
        """

        def create_rule(env_idx: int, end: datetime, project_ids: List[int]):
            condition = {"op": "equals", "name": "environment", "value": f"prod{env_idx}"}
            return CustomDynamicSamplingRule.update_or_create(
                condition=condition,
                start=timezone.now() - timedelta(hours=5),
                end=end,
                project_ids=project_ids,
                organization_id=self.organization.id,
                num_samples=100,
                sample_rate=0.5,
                query=f"environment:prod{env_idx}",
            )

        env_idx = 1
        expired_rules: Set[int] = set()
        active_rules: Set[int] = set()

        for projects in [
            [self.project],
            [self.second_project],
            [self.third_project],
            [self.project, self.second_project, self.third_project],
            [],
        ]:
            # create some expired rules
            project_ids = [p.id for p in projects]
            rule = create_rule(env_idx, timezone.now() - timedelta(minutes=5), project_ids)
            expired_rules.add(rule.id)
            env_idx += 1

            # create some active rules
            rule = create_rule(env_idx, timezone.now() + timedelta(minutes=5), project_ids)
            active_rules.add(rule.id)
            env_idx += 1

        # check that all rules are active before deactivation
        for rule in CustomDynamicSamplingRule.objects.all():
            assert rule.is_active

        CustomDynamicSamplingRule.deactivate_expired_rules()

        # check that all expired rules are inactive and all active rules are still active
        for rule in CustomDynamicSamplingRule.objects.all():
            if rule.id in expired_rules:
                assert not rule.is_active
            else:
                assert rule.is_active
                assert rule.id in active_rules

    def test_per_project_limit(self):
        """
        Tests that it is not possible to create more than MAX_CUSTOM_RULES_PER_PROJECT
        for a project
        """

        # a few org rules
        num_org_rules = 10
        for idx in range(num_org_rules):
            _create_rule_for_env(idx, [], self.organization)

        # now add project rules (up to MAX_CUSTOM_RULES_PER_PROJECT)
        for idx in range(num_org_rules, MAX_CUSTOM_RULES_PER_PROJECT):
            _create_rule_for_env(idx, [self.project], self.organization)
            _create_rule_for_env(idx, [self.second_project], self.organization)

        # we've reached the limit for both project and second_project next one should raise TooManyRules()
        with pytest.raises(TooManyRules):
            _create_rule_for_env(MAX_CUSTOM_RULES_PER_PROJECT, [self.project], self.organization)

        with pytest.raises(TooManyRules):
            _create_rule_for_env(
                MAX_CUSTOM_RULES_PER_PROJECT, [self.second_project], self.organization
            )
