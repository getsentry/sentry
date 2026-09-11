from collections import defaultdict
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase, UnknownEnvironments
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.discover.arithmetic import is_equation, strip_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.utils import check_attribute_names_exist, serialize_search_type
from sentry.search.events import fields
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import RPC_DATASETS


class Validation(TypedDict):
    valid: bool
    error: str | None


class NamedValidation(Validation):
    name: str


class AttributeValidation(NamedValidation):
    # None when its an error
    attrType: str | None


class QueryValidation(Validation):
    fields: list[AttributeValidation]


class ValidationResponse(TypedDict):
    valid: bool
    dataset: list[NamedValidation]
    environment: list[Validation]
    field: list[AttributeValidation]
    orderby: list[AttributeValidation]
    projects: list[Validation]
    query: QueryValidation


def check_attributes_exist(
    resolver: SearchResolver,
    attrs_by_type: dict[AttributeKey.Type.ValueType, list[ResolvedAttribute]],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute internal names exist in storage."""
    if not attrs_by_type:
        return set()

    meta = resolver.resolve_meta(referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_VALIDATE.value)

    return check_attribute_names_exist(
        meta,
        {
            attr_type: [attribute.internal_name for attribute in attributes]
            for attr_type, attributes in attrs_by_type.items()
        },
    )


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsValidateEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def serialize_response(
        self,
        validity: ValidationResponse,
    ) -> Response[ValidationResponse]:
        return Response(
            status=200 if validity["valid"] else 400,
            data=validity,
        )

    def validate_columns(
        self, columns: list[str], resolver: Any
    ) -> tuple[
        list[AttributeValidation], dict[AttributeKey.Type.ValueType, list[ResolvedAttribute]], bool
    ]:
        definitions = resolver.definitions
        validities: list[AttributeValidation] = []
        attributes_to_lookup = defaultdict(list)
        valid = True
        for column in columns:
            try:
                match = fields.is_function(column)
                if match:
                    resolved, _ = resolver.resolve_function(column, match)
                    validities.append(
                        AttributeValidation(
                            attrType=serialize_search_type(resolved.search_type),
                            error=None,
                            name=column,
                            valid=True,
                        )
                    )
                else:
                    resolved, _ = resolver.resolve_attribute(column)
                    if column in definitions.contexts or column in definitions.columns:
                        validities.append(
                            AttributeValidation(
                                attrType=serialize_search_type(resolved.search_type),
                                error=None,
                                name=column,
                                valid=True,
                            )
                        )
                    else:
                        attributes_to_lookup[resolved.proto_type].append(resolved)
            except InvalidSearchQuery as error:
                valid = False
                validities.append(
                    AttributeValidation(
                        attrType=None,
                        error=str(error),
                        name=column,
                        valid=False,
                    )
                )
        return validities, attributes_to_lookup, valid

    @extend_schema(
        operation_id="validateOrganizationEventsQuery",
        summary="Validate an Explore Query",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            VisibilityParams.DATASET,
            VisibilityParams.FIELD,
            VisibilityParams.QUERY,
            VisibilityParams.SORT,
        ],
        responses={
            # Both statuses carry the same body: the endpoint reports validity in
            # `valid` and returns 400 when any part of the query is invalid.
            200: inline_sentry_response_serializer(
                "ValidateEventsQueryResponse", ValidationResponse
            ),
            400: inline_sentry_response_serializer(
                "InvalidEventsQueryResponse", ValidationResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[ValidationResponse] | Response[None]:
        """
        Check whether a set of fields, a search query, and a sort would form a valid
        query, without running it. Reports each field, orderby, and query term
        separately so an invalid one can be corrected in place; `valid` is false and
        the status is 400 when any part fails.
        """
        if not self.has_feature(organization, request):
            return Response(status=400)

        response = ValidationResponse(
            valid=True,
            dataset=[],
            environment=[],
            field=[],
            orderby=[],
            projects=[],
            query=QueryValidation(valid=True, error=None, fields=[]),
        )

        try:
            snuba_params = self.get_snuba_params(
                request,
                organization,
            )
        except NoProjects:
            response["valid"] = False
            response["projects"].append(
                Validation(valid=False, error="At least one valid project is required to query")
            )
            return self.serialize_response(response)
        except UnknownEnvironments as error:
            response["valid"] = False
            response["environment"].append(Validation(valid=False, error=str(error)))
            return self.serialize_response(response)

        try:
            dataset = self.get_dataset(request, organization)
        except ParseError as error:
            response["valid"] = False
            response["dataset"].append(
                NamedValidation(
                    name=request.GET.get("dataset", "discover"), valid=False, error=str(error)
                )
            )
            return self.serialize_response(response)

        if dataset not in RPC_DATASETS:
            response["dataset"].append(
                NamedValidation(
                    name=request.GET.get("dataset", "discover"),
                    valid=True,
                    error="This dataset is not compatible with the validate endpoint, your request may still be valid",
                )
            )
            # Can't continue if this isn't a RPC dataset
            return self.serialize_response(response)

        resolver = dataset.get_resolver(snuba_params, SearchResolverConfig())

        # Validate selected_columns
        selected_columns = self.get_field_list(organization, request)
        column_validity, field_attributes_to_lookup, valid = self.validate_columns(
            selected_columns, resolver
        )
        if not valid:
            response["valid"] = valid

        # Validate query
        query_string = request.GET.get("query", "")
        query_attributes_to_lookup: dict[AttributeKey.Type.ValueType, list[ResolvedAttribute]] = {}
        query_columns = []
        try:
            try:
                parsed_terms = resolver.parse_search_query(query_string)
            except InvalidSearchQuery as err:
                # If we fail to parse, try again but truncate the query to hopefully get some terms
                if err.extra is not None:
                    try:
                        parsed_terms = resolver.parse_search_query(
                            query_string[: err.extra.get("idx", 0) - 1]
                        )
                    except InvalidSearchQuery:
                        # If we fail again don't bubble the error up
                        parsed_terms = []
                else:
                    parsed_terms = []
            query_columns = resolver.collect_terms(parsed_terms)
            query_field_validity, query_attributes_to_lookup, valid = self.validate_columns(
                query_columns, resolver
            )
            response["query"]["fields"] = query_field_validity
            if not valid:
                response["valid"] = valid
            # While resolve_query also runs parse_search_query, we don't need the resolved_query just want to dry-run it
            # to get any errors
            resolver.resolve_query(query_string)
        except InvalidSearchQuery as error:
            response["valid"] = False
            response["query"]["error"] = str(error)
            response["query"]["valid"] = False

        # Lookup unknown fields and add to validities
        # Combine the lookup dictionaries
        attributes_to_lookup: dict[AttributeKey.Type.ValueType, list[ResolvedAttribute]] = (
            query_attributes_to_lookup.copy()
        )
        for attribute_type, attributes in field_attributes_to_lookup.items():
            if attribute_type not in attributes_to_lookup:
                attributes_to_lookup[attribute_type] = []
            attributes_to_lookup[attribute_type].extend(attributes)

        if any(len(attributes) > 0 for attributes in attributes_to_lookup.values()):
            # Group by proto type because the storage check is keyed on
            # (proto_type, internal_name) — the same display name can exist
            # as both a string and a number attribute simultaneously.
            with handle_query_errors():
                existing = check_attributes_exist(resolver, attributes_to_lookup)
                for attribute_type, attributes in attributes_to_lookup.items():
                    for resolved in attributes:
                        if (resolved.proto_type, resolved.internal_name) in existing:
                            validity = AttributeValidation(
                                attrType=serialize_search_type(resolved.search_type),
                                error=None,
                                name=resolved.public_alias,
                                valid=True,
                            )
                        else:
                            response["valid"] = False
                            validity = AttributeValidation(
                                attrType=None,
                                error="Unknown attribute",
                                name=resolved.public_alias,
                                valid=False,
                            )
                        if (
                            resolved.public_alias in selected_columns
                            and validity not in column_validity
                        ):
                            column_validity.append(validity)
                        if (
                            resolved.public_alias in query_columns
                            and validity not in response["query"]["fields"]
                        ):
                            response["query"]["fields"].append(validity)

        response["field"].extend(column_validity)
        # If the response is still valid check if there's a field validity we wanna use
        if response["query"]["valid"]:
            for field in response["query"]["fields"]:
                if not field["valid"]:
                    response["query"]["valid"] = False
                    response["query"]["error"] = field["error"]
                    break

        # Validate orderby
        orderby_validity = []
        orderby_columns = self.get_orderby(request)
        equation_list = self.get_equation_list(organization, request)
        if orderby_columns:
            for orderby in orderby_columns:
                stripped_orderby = orderby.lstrip("-")
                found = False
                for field in column_validity:
                    if (
                        field["name"] == stripped_orderby
                        or fields.get_function_alias(field["name"]) == stripped_orderby
                    ):
                        orderby_validity.append(
                            AttributeValidation(
                                attrType=field["attrType"], error=None, name=orderby, valid=True
                            )
                        )
                        found = True
                        break
                if not found and is_equation(stripped_orderby):
                    equation_body = strip_equation(stripped_orderby)
                    if equation_body in equation_list:
                        orderby_validity.append(
                            AttributeValidation(attrType=None, error=None, name=orderby, valid=True)
                        )
                        found = True
                if not found:
                    response["valid"] = False
                    orderby_validity.append(
                        AttributeValidation(
                            attrType=None,
                            error="Orderby must also be a selected field",
                            name=orderby,
                            valid=False,
                        )
                    )
        response["orderby"].extend(orderby_validity)

        return self.serialize_response(response)
