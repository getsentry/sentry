from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, Mapping, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import (
    CharField,
    ChoiceField,
    IntegerField,
    ListField,
    ValidationError,
)
from rest_framework.serializers import Serializer as RequestSerializer

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.discover.arithmetic import (
    ArithmeticParseError,
    ArithmeticValidationError,
    parse_arithmetic,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.explore.models import (
    ExploreSavedFormula,
    ExploreSavedQueryDataset,
    ExploreSavedVariable,
    KindItemTypes,
    ParamItemTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.utils import parse_formula
from sentry.search.events.constants import DURATION_UNITS, SIZE_UNITS, DurationUnit, SizeUnit
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

DATASETS = {
    ExploreSavedQueryDataset.SPANS: Spans,
    ExploreSavedQueryDataset.OURLOGS: OurLogs,
}


class ExploreSavedReference(TypedDict):
    name: str
    value: str


class ExploreSavedParam(ExploreSavedReference):
    type: str
    order: int


class ExploreSavedFormulaResponse(TypedDict):
    formula: str
    id: str
    name: str
    params: list[ExploreSavedParam]
    references: list[ExploreSavedReference]
    dataset: str
    type: str
    unit: str | None


class ExploreSavedReferencesSerializer(Serializer[ExploreSavedReference]):
    def serialize(
        self,
        obj: ExploreSavedVariable,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ExploreSavedReference:
        return {
            "name": obj.name,
            "value": obj.value,
        }


class ExploreSavedParamsSerializer(Serializer[ExploreSavedParam]):
    def serialize(
        self,
        obj: ExploreSavedVariable,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ExploreSavedParam:
        return {
            "name": obj.name,
            "order": obj.order,
            "type": ParamItemTypes.get_type_name(obj.param_type),
            "value": obj.value,
        }


class ExploreSavedFormulaSerializer(Serializer[ExploreSavedFormulaResponse]):
    def serialize(
        self,
        obj: ExploreSavedFormula,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ExploreSavedFormulaResponse:
        # Make sure that we use the prefetch
        variables = list(obj.variables.all())
        params = sorted(
            (var for var in variables if var.kind == KindItemTypes.PARAM), key=lambda var: var.order
        )
        # order by name so references return in a consistent order
        references = sorted(
            (var for var in variables if var.kind == KindItemTypes.REFERENCE),
            key=lambda var: var.name,
        )
        data: ExploreSavedFormulaResponse = {
            "formula": obj.formula,
            "id": str(obj.id),
            "name": obj.name,
            "dataset": ExploreSavedQueryDataset.get_type_name(obj.dataset),
            "params": serialize(params, user, serializer=ExploreSavedParamsSerializer()),
            "references": serialize(
                references, user, serializer=ExploreSavedReferencesSerializer()
            ),
            "type": obj.formula_type,
            "unit": obj.unit,
        }
        return data


class FormulaParamData(TypedDict):
    name: str
    value: str
    param_type: int
    order: int


class FormulaReferenceData(TypedDict):
    name: str
    value: str


class FormulaData(TypedDict):
    formula: str
    name: str
    unit: SizeUnit | DurationUnit | None
    params: list[FormulaParamData]
    references: list[FormulaReferenceData]
    dataset: int


class ReferenceSerializer(RequestSerializer):
    name = CharField(max_length=200)
    value = CharField(max_length=200, allow_blank=True)


class ParamSerializer(ReferenceSerializer):
    type = CharField(source="param_type")
    order = IntegerField(min_value=0, max_value=3)

    def validate_type(self, parameter_type: str) -> int:
        param_type = ParamItemTypes.get_id_for_type_name(parameter_type)
        if param_type is None:
            raise ValidationError("Invalid param type")
        return param_type

    def validate(self, data: FormulaParamData) -> FormulaParamData:
        if data["param_type"] == ParamItemTypes.CALCULATION and not data["value"]:
            raise ValidationError({"value": "Calculations must have a value"})
        return data


class FormulaSerializer(RequestSerializer):
    formula = CharField(max_length=2500)
    name = CharField(max_length=200)
    unit = ChoiceField(
        choices=list(SIZE_UNITS.keys()) + list(DURATION_UNITS.keys()),
        allow_null=True,
        required=False,
        default=None,
    )
    params = ListField(
        child=ParamSerializer(),
    )
    references = ListField(
        child=ReferenceSerializer(),
    )
    dataset = ChoiceField(
        choices=ExploreSavedQueryDataset.as_text_choices(),
        required=True,
    )

    def validate_dataset(self, dataset: str) -> int:
        dataset_id = ExploreSavedQueryDataset.get_id_for_type_name(dataset)
        if dataset_id is None:
            raise ValidationError("Invalid dataset value")
        if dataset_id not in DATASETS:
            raise ValidationError(
                f"{dataset} is not supported yet, currently only Spans and Logs are supported"
            )
        return dataset_id

    def validate_name(self, name: str) -> str:
        if not name.startswith("formula."):
            raise ValidationError("Formula names must begin with `formula`")
        return name

    def validate(self, data: FormulaData) -> FormulaData:
        # Convert the dicts to simplenamespace objects so they; can be used in parse_formula
        data["params"] = sorted(data["params"], key=lambda p: p["order"])
        calculations = [
            SimpleNamespace(**param)
            for param in data["params"]
            if param["param_type"] == ParamItemTypes.CALCULATION
        ]
        parameters = [
            SimpleNamespace(**param)
            for param in data["params"]
            if param["param_type"] != ParamItemTypes.CALCULATION
        ]

        dataset = data["dataset"]
        resolved_dataset = DATASETS.get(dataset)
        if resolved_dataset is None:
            raise ValidationError(
                f"{dataset} is not supported yet, currently only Spans and Logs are supported"
            )

        resolver = resolved_dataset.get_resolver(SnubaParams(), SearchResolverConfig())
        try:
            formula = parse_formula(
                data["formula"],
                [
                    "1" if param.param_type == ParamItemTypes.NUMBER else "span.duration"
                    for param in parameters
                ],
                parameters,
                calculations,
                [SimpleNamespace(**param) for param in data["references"]],
                resolver.resolve_column,
            )
        except InvalidSearchQuery as e:
            raise ValidationError(str(e))
        try:
            parse_arithmetic(formula)
        except (ArithmeticParseError, ArithmeticValidationError) as e:
            raise ValidationError(str(e))

        return data


class OrganizationExploreFormulaBase(OrganizationEndpoint):
    owner = ApiOwner.DATA_BROWSING

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:explore-saved-formulas", organization, actor=request.user
        )


@contextmanager
def write_formula_to_db() -> Iterator[None]:
    try:
        with transaction.atomic(using=router.db_for_write(ExploreSavedFormula)):
            yield
    except IntegrityError as e:
        if "explore_exploresavedformula_unique_name_per_organization" in str(e):
            raise ParseError("Formula name must be unique")
        elif "explore_exploresavedvariable_unique_name_per_formula" in str(e):
            raise ParseError("Reference and parameter names must be unique")
        elif "explore_exploresavedvariable_unique_order_per_formula" in str(e):
            raise ParseError("Orderby values must be unique")
        # If its not one of our known integrity errors raise it again
        raise


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationExploreFormulas(OrganizationExploreFormulaBase):
    """This endpoint returns a list of formulas for an org, or allows you to create a formula"""

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[ExploreSavedFormulaResponse]]:
        """Return a list of formulas

        Formulas have a name and a formula definition, the definition will have variables in it that are either
        references or parameters. Once a formula is defined it will be accessible anywhere functions are, but because of
        that they must have the `formula.` prefix so we don't overlap with any existing functions.
        Parameters are what can be passed to the formula when its added as a function in a query, eg. the threshold in
        apdex(threshold)
        References are only there to make constructing complex formulas more easily, so similar to a variable or
        "Syntactic sugar"
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        queryset = (
            ExploreSavedFormula.objects.filter(organization=organization)
            .prefetch_related(
                "variables"
                # TODO: add an orderby parameter, sorting by name for now
            )
            .order_by("name")
        )

        def data_fn(offset: int, limit: int) -> list[ExploreSavedFormula]:
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda formula: serialize(
                formula, request.user, serializer=ExploreSavedFormulaSerializer()
            ),
            default_per_page=50,
        )

    def post(
        self, request: Request, organization: Organization
    ) -> Response[ExploreSavedFormulaResponse] | Response[ValidationErrorResponse]:
        """Create a formula"""
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = FormulaSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        data = serializer.validated_data

        with write_formula_to_db():
            formula = ExploreSavedFormula.objects.create(
                organization=organization,
                created_by_id=request.user.id,
                formula=data["formula"],
                name=data["name"],
                unit=data["unit"],
                dataset=data["dataset"],
            )
            for param in data["params"]:
                ExploreSavedVariable.objects.create(
                    organization=organization,
                    explore_saved_formula=formula,
                    name=param["name"],
                    value=param["value"],
                    param_type=param["param_type"],
                    order=param["order"],
                    kind=KindItemTypes.PARAM,
                )
            for param in data["references"]:
                ExploreSavedVariable.objects.create(
                    organization=organization,
                    explore_saved_formula=formula,
                    name=param["name"],
                    value=param["value"],
                    kind=KindItemTypes.REFERENCE,
                )

        return Response(
            serialize(formula, request.user, serializer=ExploreSavedFormulaSerializer()),
            status=201,
        )


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationExploreFormulasDetail(OrganizationExploreFormulaBase):
    """This endpoint allows for the editing, retrieval or deletion of a single formula from its id"""

    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        id: int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["formula"] = ExploreSavedFormula.objects.prefetch_related("variables").get(
                id=id,
                organization=kwargs["organization"],
            )
        except ExploreSavedFormula.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(
        self, request: Request, organization: Organization, formula: ExploreSavedFormula
    ) -> Response[ExploreSavedFormulaResponse]:
        """
        Retrieve a saved formula
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        return Response(
            serialize(formula, request.user, serializer=ExploreSavedFormulaSerializer()),
            status=200,
        )

    def delete(
        self, request: Request, organization: Organization, formula: ExploreSavedFormula
    ) -> Response[None]:
        """
        Delete a saved formula
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        formula.delete()

        return Response(status=204)

    def put(
        self, request: Request, organization: Organization, formula: ExploreSavedFormula
    ) -> Response[ExploreSavedFormulaResponse] | Response[ValidationErrorResponse]:
        """
        Update a saved formula
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = FormulaSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        data = serializer.validated_data

        with write_formula_to_db():
            formula.update(
                formula=data["formula"],
                name=data["name"],
                unit=data["unit"],
                dataset=data["dataset"],
                updated_by_id=request.user.id,
            )
            ExploreSavedVariable.objects.filter(explore_saved_formula=formula).delete()
            for param in data["params"]:
                ExploreSavedVariable.objects.create(
                    organization=organization,
                    explore_saved_formula=formula,
                    name=param["name"],
                    value=param["value"],
                    param_type=param["param_type"],
                    order=param["order"],
                    kind=KindItemTypes.PARAM,
                )
            for param in data["references"]:
                ExploreSavedVariable.objects.create(
                    organization=organization,
                    explore_saved_formula=formula,
                    name=param["name"],
                    value=param["value"],
                    kind=KindItemTypes.REFERENCE,
                )

        formula.refresh_from_db()

        return Response(
            serialize(formula, request.user, serializer=ExploreSavedFormulaSerializer()),
            status=200,
        )
