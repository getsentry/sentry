from datetime import datetime, timedelta

import pytest

from sentry.api.endpoints.custom_rules import (
    DEFAULT_PERIOD_STRING,
    MAX_RULE_PERIOD_STRING,
    CustomRulesInputSerializer,
)
from sentry.models.dynamicsampling import CUSTOM_RULE_DATE_FORMAT
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


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
