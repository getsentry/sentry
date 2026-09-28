from collections.abc import Iterator
from contextlib import contextmanager
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
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.explore.models import (
    ExploreSavedFormula,
    ExploreSavedVariable,
    KindItemTypes,
    ParamItemTypes,
)
from sentry.models.organization import Organization
from sentry.search.events.constants import DURATION_UNITS, SIZE_UNITS
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


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
            "params": serialize(params, user, serializer=ExploreSavedParamsSerializer()),
            "references": serialize(
                references, user, serializer=ExploreSavedReferencesSerializer()
            ),
            "type": obj.formula_type,
            "unit": obj.unit,
        }
        return data


class ReferenceSerializer(RequestSerializer):
    name = CharField(max_length=200)
    value = CharField(max_length=200, allow_blank=True)


class ParamSerializer(ReferenceSerializer):
    type = CharField(source="param_type")
    order = IntegerField(max_value=3)

    def validate_type(self, value: str) -> int:
        param_type = ParamItemTypes.get_id_for_type_name(value)
        if param_type is None:
            raise ValidationError("Invalid param type")
        return param_type


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

    # TODO: still need to validate that the formula & params resolve to a parseable equation

    def validate_name(self, name: str) -> str:
        if not name.startswith("formula."):
            raise ValidationError("Formula names must begin with `formula`")
        return name


class OrganizationExploreFormulaBase(OrganizationEndpoint):
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
        """Return a list of formulas"""
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
