from collections.abc import Iterator, MutableMapping, Sequence
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, Mapping, NotRequired, TypedDict

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models.functions import Substr
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import (
    BooleanField,
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
from sentry.api.utils import SortBy, parse_sort_by, to_valid_int_id
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.discover.arithmetic import (
    ArithmeticParseError,
    ArithmeticValidationError,
    parse_arithmetic,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.explore.endpoints.bases import ExploreSavedFormulaPermission
from sentry.explore.models import (
    ExploreSavedFormula,
    ExploreSavedQueryDataset,
    ExploreSavedVariable,
    KindItemTypes,
    ParamItemTypes,
)
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.utils import check_numeric, parse_formula
from sentry.search.events.constants import DURATION_UNITS, SIZE_UNITS, DurationUnit, SizeUnit
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.locking import UnableToAcquireLock

DATASETS = {
    ExploreSavedQueryDataset.SPANS: Spans,
    ExploreSavedQueryDataset.OURLOGS: OurLogs,
    ExploreSavedQueryDataset.METRICS: TraceMetrics,
}
MAX_INPUT_PARAMS = 2
MAX_GENERIC_PARAMS = 7
MAX_REFERENCES = 5
FORMULA_PREFIX = "formula."


class ExploreSavedReference(TypedDict):
    name: str
    value: str


class ExploreSavedParam(ExploreSavedReference):
    type: str
    order: int


class PrebuiltFormula(TypedDict):
    prebuilt_id: int
    name: str
    description: str
    formula: str
    unit: str | None
    dataset: str
    references: list[ExploreSavedReference]
    params: list[ExploreSavedParam]


PREBUILT_FORMULAS: list[PrebuiltFormula] = [
    {
        "prebuilt_id": 1,
        "name": f"{FORMULA_PREFIX}apdex",
        "description": "(Application Performance Index) Calculates apdex a weighted average of user experiences",
        "formula": "({count_satisfied} + {count_tolerating} / 2) / count()",
        "unit": None,
        "dataset": "spans",
        "references": [
            {
                "name": "count_satisfied",
                "value": "count_if(`{duration}:<{threshold}`)",
            },
            {
                "name": "count_tolerating",
                "value": "count_if(`{duration}:>={threshold} and {duration}:<={frustrated}`)",
            },
        ],
        "params": [
            {
                "name": "duration",
                "type": "column",
                "order": 0,
                "value": "span.duration",
            },
            {
                "name": "threshold",
                "type": "number",
                "order": 1,
                "value": "300",
            },
            {
                "name": "frustrated",
                "type": "calculation",
                "order": 2,
                "value": "{threshold} * 4",
            },
        ],
    },
    {
        "prebuilt_id": 2,
        "name": f"{FORMULA_PREFIX}user_misery",
        "description": "Calculates a user misery score that tries to not let low throughput transactions have a high score using weights, 5.8875 in the numerator and 111.8625 in the denominator",
        "formula": "({miserable_users} + 5.8875) / ({total_unique_users} + 111.8625 + 5.8875)",
        "unit": None,
        "dataset": "spans",
        "references": [
            {
                "name": "miserable_users",
                "value": "count_unique_if(`is_transaction:True and {duration}:>{frustrated}`, user)",
            },
            {
                "name": "total_unique_users",
                "value": "count_unique_if(`is_transaction:True and has:{duration}`, user)",
            },
        ],
        "params": [
            {
                "name": "duration",
                "type": "column",
                "order": 0,
                "value": "span.duration",
            },
            {
                "name": "threshold",
                "type": "number",
                "order": 1,
                "value": "300",
            },
            {
                "name": "frustrated",
                "type": "calculation",
                "order": 2,
                "value": "{threshold} * 4",
            },
        ],
    },
]


class ExploreSavedFormulaResponse(TypedDict):
    createdBy: UserSerializerResponse | None
    dataset: str
    description: str | None
    formula: str
    id: str
    name: str
    params: list[ExploreSavedParam]
    prebuilt: bool
    references: list[ExploreSavedReference]
    type: str
    unit: str | None
    updatedBy: UserSerializerResponse | None


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
    def get_attrs(
        self,
        item_list: Sequence[ExploreSavedFormula],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[ExploreSavedFormula, dict[str, Any]]:
        user_ids = set()
        for formula in item_list:
            for uid in (formula.created_by_id, formula.updated_by_id):
                if uid:
                    user_ids.add(uid)

        if user_ids:
            service_serialized = user_service.serialize_many(
                filter={"user_ids": list(user_ids)},
                as_user=user if user.id else None,
            )
            serialized_users = {user["id"]: user for user in service_serialized}
        else:
            serialized_users = {}

        return {
            formula: {
                "createdBy": serialized_users.get(str(formula.created_by_id)),
                "updatedBy": serialized_users.get(str(formula.updated_by_id)),
            }
            for formula in item_list
        }

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
            "description": obj.description,
            "params": serialize(params, user, serializer=ExploreSavedParamsSerializer()),
            "references": serialize(
                references, user, serializer=ExploreSavedReferencesSerializer()
            ),
            "type": obj.formula_type,
            "unit": obj.unit,
            "prebuilt": obj.prebuilt_id is not None,
            "updatedBy": attrs.get("updatedBy"),
            "createdBy": attrs.get("createdBy"),
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
    description: str | None
    name: str
    unit: SizeUnit | DurationUnit | None
    params: list[FormulaParamData]
    references: list[FormulaReferenceData]
    dataset: int


class ReferenceSerializer(RequestSerializer):
    name = CharField(max_length=200)
    value = CharField(max_length=200, allow_blank=True)

    def validate_value(self, value: str) -> str:
        value = value.lower()
        if len(value) == 0:
            raise ValidationError("References must have a value")
        return value

    def validate_name(self, name: str) -> str:
        return name.lower()


class ParamSerializer(ReferenceSerializer):
    type = CharField(source="param_type")
    order = IntegerField(min_value=0, max_value=MAX_GENERIC_PARAMS)

    def validate_value(self, value: str) -> str:
        return value.lower()

    def validate_type(self, parameter_type: str) -> int:
        param_type = ParamItemTypes.get_id_for_type_name(parameter_type)
        if param_type is None:
            raise ValidationError("Invalid param type")
        return param_type

    def validate(self, data: FormulaParamData) -> FormulaParamData:
        if data["param_type"] == ParamItemTypes.CALCULATION and not data["value"]:
            raise ValidationError({"value": "Calculations must have a value"})
        elif data["param_type"] == ParamItemTypes.NUMBER and data["value"]:
            try:
                check_numeric(data["value"], data["name"])
            except ValueError:
                raise ValidationError(
                    {"value": f"'{data['value']}' is an invalid value for a numeric default"}
                )
            except InvalidSearchQuery as e:
                raise ValidationError({"value": str(e)})
        return data


class FormulaSerializer(RequestSerializer):
    formula = CharField(max_length=2500)
    name = CharField(max_length=200)
    description = CharField(max_length=280, allow_null=True)
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

    def validate_formula(self, formula: str) -> str:
        return formula.lower()

    def validate_params(self, params: list[FormulaParamData]) -> list[FormulaParamData]:
        non_calculation_params = [
            param
            for param in params
            if param["param_type"] != ParamItemTypes.get_id_for_type_name("calculation")
        ]
        if len(non_calculation_params) > MAX_INPUT_PARAMS:
            raise ValidationError(
                f"Cannot have more than {MAX_INPUT_PARAMS} number or column parameters per formula"
            )
        if len(params) > MAX_GENERIC_PARAMS:
            raise ValidationError(
                f"Cannot have more than {MAX_GENERIC_PARAMS} parameters per formula"
            )
        return params

    def validate_references(
        self, references: list[FormulaReferenceData]
    ) -> list[FormulaReferenceData]:
        if len(references) > MAX_REFERENCES:
            raise ValidationError(f"Cannot have more than {MAX_REFERENCES} references per formula")
        return references

    def validate_name(self, name: str) -> str:
        name = name.lower()
        if not name.startswith(FORMULA_PREFIX):
            raise ValidationError("Formula names must begin with `formula`")
        return name

    def validate_dataset(self, dataset: str) -> int:
        dataset_id = ExploreSavedQueryDataset.get_id_for_type_name(dataset)
        if dataset_id is None:
            raise ValidationError("Invalid dataset value")
        if dataset_id not in DATASETS:
            raise ValidationError(
                f"{dataset} is not supported yet, currently only Spans and Logs are supported"
            )
        return dataset_id

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
                resolver,
            )
        except InvalidSearchQuery as e:
            raise ValidationError(str(e))
        try:
            parse_arithmetic(formula, definitions=resolver.definitions)
        except (ArithmeticParseError, ArithmeticValidationError) as e:
            raise ValidationError(str(e))

        return data


class FormulaListQuery(TypedDict):
    name: NotRequired[str]
    parameter: NotRequired[str]
    reference: NotRequired[str]
    sortBy: SortBy
    prebuilt: NotRequired[bool]


class FormulaListSerializer(RequestSerializer[None, FormulaListQuery]):
    name = CharField(max_length=200, required=False)
    parameter = CharField(max_length=200, required=False)
    reference = CharField(max_length=200, required=False)
    sortBy = CharField(max_length=200, required=False, default="name")
    prebuilt = BooleanField(required=False)

    def validate_sortBy(self, sortby: str) -> SortBy:
        return parse_sort_by(sortby, allowed_fields=["name", "description"])

    def validate_name(self, name: str) -> str:
        return name.lower()

    def validate_parameter(self, name: str) -> str:
        return name.lower()

    def validate_reference(self, name: str) -> str:
        return name.lower()


class OrganizationExploreFormulaBase(OrganizationEndpoint):
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (ExploreSavedFormulaPermission,)

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


def sync_prebuilt_formulas(organization: Organization) -> None:
    """
    Queries the database to check if prebuilt formulas have an ExploreSavedFormula record and
    creates them if they don't
    """
    with transaction.atomic(router.db_for_write(ExploreSavedFormula)):
        saved_prebuilt_queries = ExploreSavedFormula.objects.filter(
            organization=organization,
            prebuilt_id__isnull=False,
        )

        saved_prebuilt_query_ids = set(saved_prebuilt_queries.values_list("prebuilt_id", flat=True))
        saved_prebuilt_names = set(saved_prebuilt_queries.values_list("name", flat=True))

        # Create prebuilt formulas if they don't exist
        formulas_to_create = []
        variables_to_create = []
        validated_formulas = []
        for prebuilt_formula in PREBUILT_FORMULAS:
            # Users can update the prebuilts so if its already there don't touch it again
            if prebuilt_formula["prebuilt_id"] in saved_prebuilt_query_ids:
                continue
            if prebuilt_formula["name"] in saved_prebuilt_names:
                continue
            # Ensure the prebuilt query is valid also provides mapping for some fields such as the dataset string `spans` into the int `0`
            serializer = FormulaSerializer(
                data=prebuilt_formula,
            )
            if serializer.is_valid():
                data = serializer.validated_data
                formulas_to_create.append(
                    ExploreSavedFormula(
                        organization=organization,
                        name=data["name"],
                        formula=data["formula"],
                        description=data["description"],
                        dataset=data["dataset"],
                        created_by_id=None,
                        prebuilt_id=prebuilt_formula["prebuilt_id"],
                    )
                )
                validated_formulas.append(data)
            else:
                continue
        if len(formulas_to_create) > 0:
            created = ExploreSavedFormula.objects.bulk_create(formulas_to_create)
            for formula, data in zip(created, validated_formulas):
                for param in data["params"]:
                    variables_to_create.append(
                        ExploreSavedVariable(
                            organization=organization,
                            explore_saved_formula=formula,
                            name=param["name"],
                            value=param["value"],
                            param_type=param["param_type"],
                            order=param["order"],
                            kind=KindItemTypes.PARAM,
                        )
                    )
                for param in data["references"]:
                    variables_to_create.append(
                        ExploreSavedVariable(
                            organization=organization,
                            explore_saved_formula=formula,
                            name=param["name"],
                            value=param["value"],
                            kind=KindItemTypes.REFERENCE,
                        )
                    )
            if len(variables_to_create) > 0:
                ExploreSavedVariable.objects.bulk_create(variables_to_create)


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
    ) -> Response[list[ExploreSavedFormulaResponse]] | Response[ValidationErrorResponse]:
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

        serializer = FormulaListSerializer(
            data=request.GET.dict(), context={"organization": organization, "user": request.user}
        )
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        # Explore has prebuilt formulas that are created lazily on read.
        try:
            lock = locks.get(
                f"explore:sync_prebuilt_formulas:{organization.id}",
                duration=10,
                name="sync_prebuilt_formulas",
            )
            with lock.acquire():
                sync_prebuilt_formulas(organization)
        except UnableToAcquireLock:
            pass
        except IntegrityError as err:
            if "explore_exploresavedformula_unique_name_per_organization" not in str(err):
                sentry_sdk.capture_exception(err)
        except Exception as err:
            sentry_sdk.capture_exception(err)

        sort_by = serializer.validated_data["sortBy"]
        queryset = (
            ExploreSavedFormula.objects.filter(organization=organization, prebuilt_deleted=False)
            .prefetch_related("variables")
            # use id as a tiebreaker
            .order_by(sort_by.order_by, "-id" if sort_by.descending else "id")
        )
        if "name" in serializer.validated_data:
            queryset = queryset.annotate(
                name_suffix=Substr("name", len(FORMULA_PREFIX) + 1)
            ).filter(name_suffix__icontains=serializer.validated_data["name"])
        if "prebuilt" in serializer.validated_data:
            queryset = queryset.filter(
                prebuilt_id__isnull=not serializer.validated_data["prebuilt"]
            )
        if "parameter" in serializer.validated_data:
            queryset = queryset.filter(
                variables__kind=KindItemTypes.PARAM,
                variables__name__icontains=serializer.validated_data["parameter"],
            ).distinct()
        if "reference" in serializer.validated_data:
            queryset = queryset.filter(
                variables__kind=KindItemTypes.REFERENCE,
                variables__name__icontains=serializer.validated_data["reference"],
            ).distinct()

        def data_fn(offset: int, limit: int) -> list[ExploreSavedFormula]:
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda formula: serialize(
                formula, request.user, serializer=ExploreSavedFormulaSerializer()
            ),
            default_per_page=100,
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
                created_by_id=request.user.user_id,
                formula=data["formula"],
                description=data["description"],
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
                id=to_valid_int_id("id", id, raise_404=True),
                organization=kwargs["organization"],
                prebuilt_deleted=False,
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
                description=data["description"],
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
