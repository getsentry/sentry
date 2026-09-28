from typing import Any

from django.urls import reverse

from sentry.explore.models import (
    ExploreSavedFormula,
    ExploreSavedVariable,
    KindItemTypes,
    ParamItemTypes,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import APITestCase


class BaseFormulaTest(APITestCase):
    feature_flags = {
        "organizations:explore-saved-formulas": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.formula_object: dict[Any, Any] = {
            "name": "formula.apdex",
            "formula": "({count_satisfied} + {count_tolerating} / 2) / count()",
            "unit": None,
            "references": [
                {"name": "count_satisfied", "value": "count_if(`{duration}:<{threshold}`)"},
                {
                    "name": "count_tolerating",
                    "value": "count_if(`{duration}:>={threshold} and {duration}:<={4threshold}`)",
                },
            ],
            "params": [
                {
                    "name": "duration",
                    "type": "column",
                    "order": 0,
                    "value": "",
                },
                {
                    "name": "threshold",
                    "type": "number",
                    "order": 1,
                    "value": "",
                },
                {
                    "name": "4threshold",
                    "type": "calculation",
                    "order": 2,
                    "value": "{threshold} * 4",
                },
            ],
        }

    def create_formula(
        self, data: dict[Any, Any], organization: None | Organization = None
    ) -> ExploreSavedFormula:
        org = self.org if organization is None else organization
        formula = ExploreSavedFormula.objects.create(
            organization=org,
            formula=data["formula"],
            name=data["name"],
            unit=data["unit"],
        )
        for reference in data["references"]:
            (
                ExploreSavedVariable.objects.create(
                    organization=org,
                    name=reference["name"],
                    value=reference["value"],
                    kind=KindItemTypes.REFERENCE,
                    explore_saved_formula=formula,
                ),
            )
        for param in data["params"]:
            ExploreSavedVariable.objects.create(
                organization=self.org,
                name=param["name"],
                value=param["value"],
                param_type=ParamItemTypes.get_id_for_type_name(param["type"]),
                kind=KindItemTypes.PARAM,
                explore_saved_formula=formula,
                order=param["order"],
            )
        return formula


class TestFormulas(BaseFormulaTest):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-api-0-explore-formulas", args=[self.org.slug])

    def test_no_feature_flags(self) -> None:
        response = self.client.post(
            self.url,
            data={},
        )
        assert response.status_code == 404, response.content
        response = self.client.get(
            self.url,
        )
        assert response.status_code == 404, response.content

    def test_create_explore_formula_rejects_long_variable_value(self) -> None:
        data = self.formula_object.copy()
        data["params"] = [
            {
                "name": "duration",
                "type": "column",
                "order": 0,
                "value": "x" * 201,
            }
        ]
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "200 characters" in str(response.data["params"]["value"][0])

    def test_create_explore_formula_without_unit(self) -> None:
        data = self.formula_object.copy()
        del data["unit"]
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        formula = ExploreSavedFormula.objects.get(id=response.data["id"])
        assert formula.unit is None

    def test_create_explore_formula_without_formula_prefix(self) -> None:
        data = self.formula_object
        data["name"] = "hello"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "name" in response.data
        assert str(response.data["name"][0]) == "Formula names must begin with `formula`"

    def test_create_formula_with_overlapping_name(self) -> None:
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert str(response.data["detail"]) == "Formula name must be unique"

    def test_create_explore_formula(self) -> None:
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        formula_id = response.data["id"]
        formula = ExploreSavedFormula.objects.get(id=formula_id)
        assert formula.name == data["name"]
        assert formula.formula == data["formula"]
        assert formula.unit is None
        references = formula.variables.filter(kind=KindItemTypes.REFERENCE).order_by("name")
        assert len(references) == 2
        assert references[0].name == data["references"][0]["name"]
        assert references[0].value == data["references"][0]["value"]
        assert references[1].name == data["references"][1]["name"]
        assert references[1].value == data["references"][1]["value"]
        params = formula.variables.filter(kind=KindItemTypes.PARAM).order_by("order")
        assert len(params) == 3
        assert params[0].name == data["params"][0]["name"]
        assert ParamItemTypes.get_type_name(params[0].param_type) == data["params"][0]["type"]
        assert params[0].order == data["params"][0]["order"]
        assert params[0].value == data["params"][0]["value"]
        assert params[1].name == data["params"][1]["name"]
        assert ParamItemTypes.get_type_name(params[1].param_type) == data["params"][1]["type"]
        assert params[1].order == data["params"][1]["order"]
        assert params[1].value == data["params"][1]["value"]
        assert params[2].name == data["params"][2]["name"]
        assert ParamItemTypes.get_type_name(params[2].param_type) == data["params"][2]["type"]
        assert params[2].order == data["params"][2]["order"]
        assert params[2].value == data["params"][2]["value"]

    def test_list_explore_formulas(self) -> None:
        for i in range(5):
            self.formula_object["name"] = f"formula.apdex{i}"
            self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url,
            )
            assert response.status_code == 200, response.content
        assert len(response.data) == 5
        formula_names = [row["name"] for row in response.data]
        for i in range(5):
            assert f"formula.apdex{i}" in formula_names
