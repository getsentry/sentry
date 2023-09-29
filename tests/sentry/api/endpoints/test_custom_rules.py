from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from sentry.api.endpoints.custom_rules import (
    DEFAULT_PERIOD_STRING,
    MAX_RULE_PERIOD_STRING,
    CustomRulesInputSerializer,
)
from sentry.models.dynamicsampling import CUSTOM_RULE_DATE_FORMAT, CustomDynamicSamplingRule
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class CustomRulesGetEndpoint(APITestCase):
    """
    Tests the GET endpoint
    """

    endpoint = "sentry-api-0-organization-dynamic_sampling-custom_rules"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        second_project = self.create_project(organization=self.organization)
        third_project = self.create_project(organization=self.organization)
        fourth_project = self.create_project(organization=self.organization)
        self.known_projects = [self.project, second_project, third_project, fourth_project]

        # create a project rule for second and third project
        now = timezone.now()
        self.proj_condition = {"op": "eq", "name": "event.environment", "value": "prod"}
        start = now - timedelta(hours=2)
        end = now + timedelta(hours=2)
        projects = self.known_projects[1:3]
        CustomDynamicSamplingRule.update_or_create(
            condition=self.proj_condition,
            start=start,
            end=end,
            project_ids=projects,
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=1.0,
        )

        # create an org rule
        now = timezone.now()
        self.org_condition = {"op": "eq", "name": "event.environment", "value": "dev"}
        start = now - timedelta(hours=2)
        end = now + timedelta(hours=2)
        CustomDynamicSamplingRule.update_or_create(
            condition=self.org_condition,
            start=start,
            end=end,
            project_ids=[],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=1.0,
        )

    def test_finds_project_rule(self):
        """
        Tests that the endpoint finds the rule when the query matches and
        the existing rule contains all the requested projects

        test with the original test being a project level rule
        """

        # call the endpoint
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:prod",
                    "project": [self.known_projects[1].id],
                },
            )

        assert resp.status_code == 200
        data = resp.data
        assert data["condition"] == self.proj_condition
        assert len(data["projects"]) == 2
        assert self.known_projects[1].id in data["projects"]
        assert self.known_projects[2].id in data["projects"]
        # {'ruleId': 3001, 'condition': {'op': 'eq', 'name': 'event.environment', 'value': 'prod'}, 'startDate': '2023-09-22T12:23:35.984264Z', 'endDate': '2023-09-22T16:23:35.984264Z', 'numSamples': 100, 'sampleRate': 1.0, 'dateAdded': '2023-09-22T14:23:37.880615Z', 'projects': [4552672605044753, 4552672605044754], 'orgId': 4552672604913680}

    def test_finds_org_condition(self):
        """
        A request for either any project of org will find an org rule ( if condition matches)
        """

        # finds projects in the org rule
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:dev",
                    "project": [self.known_projects[1].id],
                },
            )
        assert resp.status_code == 200

        # finds org rule (with org request)
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:dev",
                    "project": [],
                },
            )
        assert resp.status_code == 200

    def test_does_not_find_rule_when_condition_doesnt_match(self):
        """
        Querying for a condition that doesn't match any rule returns 204
        """
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:integration",
                    "project": [self.known_projects[1].id],
                },
            )
        assert resp.status_code == 204

    def test_does_not_find_rule_when_project_doesnt_match(self):
        """
        Querying for a condition that doesn't match any rule returns 204
        """

        # it finds it when the project matches
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:prod",
                    "project": [self.known_projects[1].id],
                },
            )
        assert resp.status_code == 200
        # but it doesn't when the project doesn't match
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(
                self.organization.slug,
                qs_params={
                    "query": "environment:prod",
                    "project": [self.known_projects[0].id],
                },
            )
        assert resp.status_code == 204


@region_silo_test(stable=True)
class CustomRulesEndpoint(APITestCase):
    """
    Tests that calling the endpoint converts the query to a rule returns it and saves it in the db
    """

    endpoint = "sentry-api-0-organization-dynamic_sampling-custom_rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.second_project = self.create_project(organization=self.organization)

    def test_simple(self):
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
            "period": "1h",
            "overrideExisting": True,
        }
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        data = resp.data

        start_date = datetime.strptime(data["startDate"], CUSTOM_RULE_DATE_FORMAT)
        end_date = datetime.strptime(data["endDate"], CUSTOM_RULE_DATE_FORMAT)
        assert end_date - start_date == timedelta(hours=1)
        projects = data["projects"]
        assert projects == [self.project.id]
        org_id = data["orgId"]
        assert org_id == self.organization.id

        # check the database
        rule_id = data["ruleId"]
        rules = list(self.organization.customdynamicsamplingrule_set.all())
        assert len(rules) == 1
        rule = rules[0]
        assert rule.external_rule_id == rule_id

    def test_updates_existing(self):
        """
        Test that the endpoint updates an existing rule if the same rule condition is given

        The rule id should be the same
        The period and the projects should be updated
        """
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
            "period": "1h",
            "overrideExisting": True,
        }

        # create rule
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        data = resp.data

        rule_id = data["ruleId"]
        start_date = datetime.strptime(data["startDate"], CUSTOM_RULE_DATE_FORMAT)
        end_date = datetime.strptime(data["endDate"], CUSTOM_RULE_DATE_FORMAT)
        assert end_date - start_date == timedelta(hours=1)

        request_data = {
            "query": "event.type:transaction",
            "projects": [self.second_project.id],
            "period": "2h",
            "overrideExisting": True,
        }

        # update existing rule
        with Feature({"organizations:investigation-bias": True}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200
        data = resp.data

        start_date = datetime.strptime(data["startDate"], CUSTOM_RULE_DATE_FORMAT)
        end_date = datetime.strptime(data["endDate"], CUSTOM_RULE_DATE_FORMAT)
        assert end_date - start_date >= timedelta(hours=2)

        projects = data["projects"]
        assert self.project.id in projects
        assert self.second_project.id in projects

        new_rule_id = data["ruleId"]
        assert rule_id == new_rule_id

    def test_checks_feature(self):
        """
        Checks request fails without the feature
        """
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
            "period": "1h",
            "overrideExisting": True,
        }
        with Feature({"organizations:investigation-bias": False}):
            resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 404


@pytest.mark.parametrize(
    "what,value,valid",
    [
        ("query", "event.type:transaction", True),
        ("period", "1h", True),
        ("projects", ["abc"], False),
        ("period", "hello", False),
        ("query", "", True),
    ],
)
def test_custom_rule_serializer(what, value, valid):
    """
    Test that the serializer works as expected
    """
    data = {"query": "event.type:transaction", "projects": [], "period": "1h"}
    data[what] = value

    serializer = CustomRulesInputSerializer(data=data)

    assert serializer.is_valid() == valid


def test_custom_rule_serializer_default_period():
    """
    Test that the serializer validation sets the default period
    """
    data = {"query": "event.type:transaction", "projects": []}
    serializer = CustomRulesInputSerializer(data=data)

    assert serializer.is_valid()
    assert serializer.validated_data["period"] == DEFAULT_PERIOD_STRING


def test_custom_rule_serializer_limits_period():
    """
    Test that the serializer validation limits the peroid to the max allowed
    """
    data = {"query": "event.type:transaction", "projects": [], "period": "100d"}
    serializer = CustomRulesInputSerializer(data=data)

    assert serializer.is_valid()
    assert serializer.validated_data["period"] == MAX_RULE_PERIOD_STRING


def test_custom_rule_serializer_creates_org_rule_when_no_projects_given():
    """
    Test that the serializer creates an org level rule when no projects are given
    """
    data = {"query": "event.type:transaction", "period": "1h"}
    serializer = CustomRulesInputSerializer(data=data)

    assert serializer.is_valid()
    # an org level rule has an empty list of projects set
    assert serializer.validated_data["projects"] == []


class TestCustomRuleSerializerWithProjects(TestCase):
    def test_valid_projects(self):
        """
        Test that the serializer works with valid projects
        """
        p1 = self.create_project()
        p2 = self.create_project()

        data = {
            "query": "event.type:transaction",
            "period": "1h",
            "isOrgLevel": True,
            "projects": [p1.id, p2.id],
        }
        serializer = CustomRulesInputSerializer(data=data)

        assert serializer.is_valid()
        # an org level rule has an empty list of projects set
        assert p1.id in serializer.validated_data["projects"]
        assert p2.id in serializer.validated_data["projects"]

    def test_invalid_projects(self):
        """
        Test that the serializer works with valid projects
        """
        # some valid
        p1 = self.create_project()
        p2 = self.create_project()
        invalid_project_id = 1234
        invalid_project_id2 = 4321

        data = {
            "query": "event.type:transaction",
            "period": "1h",
            "isOrgLevel": True,
            "projects": [p1.id, invalid_project_id, p2.id, invalid_project_id2],
        }
        serializer = CustomRulesInputSerializer(data=data)
        assert not serializer.is_valid()
        # the two invalid projects should be in the error message
        assert len(serializer.errors["projects"]) == 2
