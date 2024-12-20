from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.api.endpoints.custom_rules import (
    CustomRulesInputSerializer,
    UnsupportedSearchQuery,
    UnsupportedSearchQueryReason,
    get_rule_condition,
)
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.testutils.cases import APITestCase, TestCase


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
        self.proj_condition = {
            "op": "and",
            "inner": [
                {"op": "eq", "name": "event.environment", "value": "prod"},
                {"op": "eq", "name": "event.transaction", "value": "/hello"},
            ],
        }
        start = now - timedelta(hours=2)
        end = now + timedelta(hours=2)
        projects = self.known_projects[1:3]
        CustomDynamicSamplingRule.update_or_create(
            condition=self.proj_condition,
            start=start,
            end=end,
            project_ids=[project.id for project in projects],
            organization_id=self.organization.id,
            num_samples=100,
            sample_rate=1.0,
            query="environment:prod transaction:/hello",
        )

        # create an org rule
        now = timezone.now()
        self.org_condition = {
            "op": "and",
            "inner": [
                {"op": "eq", "name": "event.transaction", "value": "/hello"},
                {"op": "eq", "name": "event.environment", "value": "dev"},
            ],
        }
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
            query="transaction:/hello environment:dev",
        )

    def test_finds_project_rule(self):
        """
        Tests that the endpoint finds the rule when the query matches and
        the existing rule contains all the requested projects

        test with the original test being a project level rule
        """
        # call the endpoint
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction environment:prod transaction:/hello",
                "project": [proj.id for proj in self.known_projects[1:3]],
            },
        )

        assert resp.status_code == 200
        data = resp.data
        assert data["condition"] == self.proj_condition
        assert len(data["projects"]) == 2
        assert self.known_projects[1].id in data["projects"]
        assert self.known_projects[2].id in data["projects"]

    def test_finds_org_condition(self):
        """
        A request for org will find an org rule ( if condition matches)
        """
        # finds projects in the org rule
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction transaction:/hello environment:dev",
                "project": [],
            },
        )
        assert resp.status_code == 200

        # finds org rule (with org request)
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction transaction:/hello environment:dev",
                "project": [],
            },
        )
        assert resp.status_code == 200

    def test_does_not_find_rule_when_condition_doesnt_match(self):
        """
        Querying for a condition that doesn't match any rule returns 204
        """
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction environment:integration",
                "project": [self.known_projects[1].id],
            },
        )
        assert resp.status_code == 204

    def test_does_not_find_rule_when_project_doesnt_match(self):
        """
        Querying for a condition that doesn't match any rule returns 204
        """
        # it finds it when the project matches
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction environment:prod transaction:/hello",
                "project": [project.id for project in self.known_projects[1:3]],
            },
        )
        assert resp.status_code == 200

        # but it doesn't when the project doesn't match
        resp = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction environment:prod transaction:/hello",
                "project": [self.known_projects[0].id],
            },
        )
        assert resp.status_code == 204

    def test_disallow_when_no_project_access(self):
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to the first project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.get_response(
            self.organization.slug,
            qs_params={
                "query": "event.type:transaction environment:prod transaction:/hello",
                "project": [self.project.id],
            },
        )
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}


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

    def test_create(self):
        request_data = {
            "query": "event.type:transaction http.method:POST",
            "projects": [self.project.id],
        }
        resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        data = resp.data

        start_date = datetime.fromisoformat(data["startDate"])
        end_date = datetime.fromisoformat(data["endDate"])
        assert end_date - start_date == timedelta(days=2)
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

    def test_disallow_when_no_project_access(self):
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to the first project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        request_data = {
            "query": "event.type:transaction http.method:POST",
            "projects": [self.project.id],
        }
        response = self.get_response(self.organization.slug, raw_data=request_data)
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_updates_existing(self):
        """
        Test that the endpoint updates an existing rule if the same rule condition and projects is given

        The rule id should be the same
        """
        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
        }

        # create rule
        resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        data = resp.data

        rule_id = data["ruleId"]
        start_date = datetime.fromisoformat(data["startDate"])
        end_date = datetime.fromisoformat(data["endDate"])
        assert end_date - start_date == timedelta(days=2)

        request_data = {
            "query": "event.type:transaction",
            "projects": [self.project.id],
        }

        # update existing rule
        resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200
        data = resp.data

        start_date = datetime.fromisoformat(data["startDate"])
        end_date = datetime.fromisoformat(data["endDate"])
        assert end_date - start_date >= timedelta(days=2)

        projects = data["projects"]
        assert projects == [self.project.id]

        new_rule_id = data["ruleId"]
        assert rule_id == new_rule_id

    @mock.patch("sentry.api.endpoints.custom_rules.schedule_invalidate_project_config")
    def test_invalidates_project_config(self, mock_invalidate_project_config):
        """
        Tests that project rules invalidates all the configurations for the
        passed projects
        """
        request_data = {
            "query": "event.type:transaction http.method:POST",
            "projects": [self.project.id, self.second_project.id],
        }

        mock_invalidate_project_config.reset_mock()
        resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        mock_invalidate_project_config.assert_any_call(trigger=mock.ANY, project_id=self.project.id)

        mock_invalidate_project_config.assert_any_call(
            trigger=mock.ANY, project_id=self.second_project.id
        )

    @mock.patch("sentry.api.endpoints.custom_rules.schedule_invalidate_project_config")
    def test_invalidates_organisation_config(self, mock_invalidate_project_config):
        """
        Tests that org rules invalidates all the configurations for the projects
        in the organisation
        """
        request_data = {
            "query": "event.type:transaction http.method:POST",
            "projects": [],
        }

        mock_invalidate_project_config.reset_mock()
        resp = self.get_response(self.organization.slug, raw_data=request_data)

        assert resp.status_code == 200

        mock_invalidate_project_config.assert_called_once_with(
            trigger=mock.ANY, organization_id=self.organization.id
        )


@pytest.mark.parametrize(
    "what,value,valid",
    [
        ("query", "event.type:transaction", True),
        ("projects", ["abc"], False),
        ("query", "", True),
    ],
)
def test_custom_rule_serializer(what, value, valid):
    """
    Test that the serializer works as expected
    """
    data = {"query": "event.type:transaction", "projects": []}
    data[what] = value

    serializer = CustomRulesInputSerializer(data=data)

    assert serializer.is_valid() == valid


def test_custom_rule_serializer_creates_org_rule_when_no_projects_given():
    """
    Test that the serializer creates an org level rule when no projects are given
    """
    data = {"query": "event.type:transaction"}
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
            "isOrgLevel": True,
            "projects": [p1.id, invalid_project_id, p2.id, invalid_project_id2],
        }
        serializer = CustomRulesInputSerializer(data=data)
        assert not serializer.is_valid()
        # the two invalid projects should be in the error message
        assert len(serializer.errors["projects"]) == 2


@pytest.mark.parametrize(
    "query,condition",
    [
        (
            "event.type:transaction",
            {"inner": [], "op": "and"},
        ),
        (
            "environment:prod event.type:transaction",
            {"op": "eq", "name": "event.environment", "value": "prod"},
        ),
        (
            "hello world event.type:transaction",
            {
                "op": "glob",
                "name": "event.transaction",
                "value": ["*hello world*"],
            },
        ),
        (
            "environment:prod hello world event.type:transaction",
            {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "event.environment", "value": "prod"},
                    {"op": "glob", "name": "event.transaction", "value": ["*hello world*"]},
                ],
            },
        ),
    ],
)
def test_get_condition(query, condition):
    """
    Test that the get_condition function works as expected
    """
    actual_condition = get_rule_condition(query)
    assert actual_condition == condition


@pytest.mark.parametrize(
    "query",
    [
        "event.type:error",
        "environment:production",
        "event.type:error environment:production",
        "",
        "hello world",
        "http.status_code:GET AND (transaction.duration:>10 AND event.type:error)",
    ],
)
def test_get_condition_not_supported(query):
    with pytest.raises(UnsupportedSearchQuery) as excinfo:
        get_rule_condition(query)

    assert excinfo.value.error_code == UnsupportedSearchQueryReason.NOT_TRANSACTION_QUERY.value


@pytest.mark.parametrize(
    "query",
    ["", "event.type:error", "environment:production"],
)
def test_get_condition_non_transaction_rule(query):
    """
    Test that the get_condition function raises UnsupportedSearchQuery when event.type is not transaction
    """
    with pytest.raises(UnsupportedSearchQuery) as excinfo:
        get_rule_condition(query)

    assert excinfo.value.error_code == UnsupportedSearchQueryReason.NOT_TRANSACTION_QUERY.value
