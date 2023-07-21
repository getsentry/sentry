from __future__ import annotations

from typing import Any, Dict, List, Union

import sentry_sdk
from django.conf import settings
from django.db import router, transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_field, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.fields import Field
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import audit_log, roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organizationmember import OrganizationMemberEndpoint
from sentry.api.endpoints.organization_member.index import OrganizationMemberSerializer
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import (
    OrganizationMemberSCIMSerializer,
    OrganizationMemberSCIMSerializerResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.scim_examples import SCIMExamples
from sentry.apidocs.parameters import GlobalParams, SCIMParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.providers.saml2.activedirectory.apps import ACTIVE_DIRECTORY_PROVIDER_NAME
from sentry.models import InviteStatus, OrganizationMember
from sentry.roles import organization_roles
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.signals import member_invited
from sentry.utils import json, metrics
from sentry.utils.cursors import SCIMCursor

from ...services.hybrid_cloud.auth import auth_service
from .constants import (
    SCIM_400_INVALID_ORGROLE,
    SCIM_400_INVALID_PATCH,
    SCIM_403_FORBIDDEN_UPDATE,
    SCIM_409_USER_EXISTS,
    MemberPatchOps,
)
from .utils import (
    OrganizationSCIMMemberPermission,
    SCIMApiError,
    SCIMEndpoint,
    SCIMQueryParamSerializer,
)

ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."


@extend_schema_field(Any)  # union field types are kind of hard, leaving Any for now.
class OperationValue(Field):
    """
    A SCIM PATCH operation value can either be a boolean,
    or an object depending on the client.
    """

    def to_representation(self, value) -> Union[Dict, bool]:
        if isinstance(value, bool):
            return value
        elif isinstance(value, dict):
            return value
        elif isinstance(value, str):
            value = resolve_maybe_bool_value(value)
            if value is not None:
                return value
        raise ValidationError("value must be a boolean or object")

    def to_internal_value(self, data) -> Union[Dict, bool]:
        if isinstance(data, bool):
            return data
        elif isinstance(data, dict):
            return data
        elif isinstance(data, str):
            value = resolve_maybe_bool_value(data)
            if value is not None:
                return value
        raise ValidationError("value must be a boolean or object")


class SCIMPatchOperationSerializer(serializers.Serializer):
    op = serializers.CharField(required=True)
    value = OperationValue()
    path = serializers.CharField(required=False)

    def validate_op(self, value: str) -> str:
        value = value.lower()
        if value in [MemberPatchOps.REPLACE]:
            return value
        raise serializers.ValidationError(f'"{value}" is not a valid choice')


class SCIMPatchRequestSerializer(serializers.Serializer):
    # we don't actually use "schemas" for anything atm but its part of the spec
    schemas = serializers.ListField(child=serializers.CharField(), required=False)

    Operations = serializers.ListField(
        child=SCIMPatchOperationSerializer(), required=True, source="operations", max_length=100
    )


def _scim_member_serializer_with_expansion(organization):
    """
    For our Azure SCIM integration, we don't want to return the `active`
    flag since we don't support soft deletes. Other integrations don't
    care about this and rely on the behavior of setting "active" to false
    to delete a member.
    """
    auth_providers = auth_service.get_auth_providers(organization_id=organization.id)
    expand = ["active"]

    if any(ap.provider == ACTIVE_DIRECTORY_PROVIDER_NAME for ap in auth_providers):
        expand = []
    return OrganizationMemberSCIMSerializer(expand=expand)


def resolve_maybe_bool_value(value):
    if isinstance(value, str):
        value = value.lower()
        # Some IdP vendors such as Azure send boolean values as actual strings.
        if value == "true":
            return True
        elif value == "false":
            return False
    if isinstance(value, bool):
        return value
    return None


@region_silo_endpoint
class OrganizationSCIMMemberDetails(SCIMEndpoint, OrganizationMemberEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)
    public = {"GET", "DELETE", "PATCH"}

    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        member_id: str = "me",
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        try:
            args, kwargs = super().convert_args(
                request, organization_slug, member_id, *args, **kwargs
            )
            return args, kwargs
        except ResourceDoesNotExist:
            raise SCIMApiError(
                status_code=ResourceDoesNotExist.status_code,
                detail=ResourceDoesNotExist.default_detail,
            )

    def _delete_member(self, request: Request, organization, member):
        audit_data = member.get_audit_log_data()
        if member.is_only_owner():
            raise PermissionDenied(detail=ERR_ONLY_OWNER)
        with transaction.atomic(router.db_for_write(OrganizationMember)):
            member.delete()
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=member.id,
                target_user_id=member.user_id,
                event=audit_log.get_event_id("MEMBER_REMOVE"),
                data=audit_data,
            )

    def _should_delete_member(self, operation):
        if operation.get("op").lower() == MemberPatchOps.REPLACE:
            if (
                isinstance(operation.get("value"), dict)
                and resolve_maybe_bool_value(operation.get("value").get("active")) is False
            ):
                # how okta sets active to false
                return True
            elif (
                operation.get("path") == "active"
                and resolve_maybe_bool_value(operation.get("value")) is False
            ):
                # how other idps set active to false
                return True
        return False

    @extend_schema(
        operation_id="Query an Individual Organization Member",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.MEMBER_ID],
        request=None,
        responses={
            200: OrganizationMemberSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.QUERY_ORG_MEMBER,
    )
    def get(self, request: Request, organization, member) -> Response:
        """
        Query an individual organization member with a SCIM User GET Request.
        - The `name` object will contain fields `firstName` and `lastName` with the values of `N/A`.
        Sentry's SCIM API does not currently support these fields but returns them for compatibility purposes.
        """
        context = serialize(
            member,
            serializer=_scim_member_serializer_with_expansion(organization),
        )
        return Response(context)

    @extend_schema(
        operation_id="Update an Organization Member's Attributes",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.MEMBER_ID],
        request=SCIMPatchRequestSerializer,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.UPDATE_ORG_MEMBER_ATTRIBUTES,
    )
    def patch(self, request: Request, organization, member):
        """
        Update an organization member's attributes with a SCIM PATCH Request.
        The only supported attribute is `active`. After setting `active` to false
        Sentry will permanently delete the Organization Member.
        """
        serializer = SCIMPatchRequestSerializer(data=request.data)

        if not serializer.is_valid():
            raise SCIMApiError(detail=json.dumps(serializer.errors))

        result = serializer.validated_data

        for operation in result["operations"]:
            # we only support setting active to False which deletes the orgmember
            if self._should_delete_member(operation):
                self._delete_member(request, organization, member)
                metrics.incr(
                    "sentry.scim.member.delete",
                    tags={"organization": organization},
                )
                return Response(status=204)
            else:
                raise SCIMApiError(detail=SCIM_400_INVALID_PATCH)

        context = serialize(
            member,
            serializer=_scim_member_serializer_with_expansion(organization),
        )
        return Response(context)

    @extend_schema(
        operation_id="Delete an Organization Member via SCIM",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.MEMBER_ID],
        request=None,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, member) -> Response:
        """
        Delete an organization member with a SCIM User DELETE Request.
        """
        self._delete_member(request, organization, member)
        metrics.incr("sentry.scim.member.delete", tags={"organization": organization})
        return Response(status=204)

    @extend_schema(
        operation_id="Update an Organization Member's Attributes",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.MEMBER_ID],
        request=inline_serializer(
            "SCIMMemberProvision", fields={"sentryOrgRole": serializers.CharField()}
        ),
        responses={
            201: OrganizationMemberSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.UPDATE_USER_ROLE,
    )
    def put(self, request: Request, organization, member):
        """
        Update an organization member

        Currently only updates organization role
        """
        # Do not allow modifications on members with the highest priority role
        if member.role == organization_roles.get_top_dog().id:
            raise SCIMApiError(detail=SCIM_403_FORBIDDEN_UPDATE, status_code=403)
        if request.data.get("sentryOrgRole"):
            # Don't update if the org role is the same
            if (
                member.flags["idp:role-restricted"]
                and member.role.lower() == request.data["sentryOrgRole"].lower()
            ):
                context = serialize(
                    member, serializer=_scim_member_serializer_with_expansion(organization)
                )
                return Response(context, status=200)

            # Update if the org role is changing and lock the role
            requested_role = request.data["sentryOrgRole"].lower()
            idp_role_restricted = True

        # if sentryOrgRole is blank
        else:
            # Don't change the role if the user isn't idp:role-restricted,
            # and they don't have the default role.
            if member.role != organization.default_role and not member.flags["idp:role-restricted"]:
                context = serialize(
                    member, serializer=_scim_member_serializer_with_expansion(organization)
                )
                return Response(context, status=200)

            # Remove role-restricted flag since org role is blank
            idp_role_restricted = False
            requested_role = organization.default_role

        # Allow any role as long as it doesn't have `org:admin` permissions
        allowed_roles = {role.id for role in roles.get_all() if not role.has_scope("org:admin")}
        if requested_role not in allowed_roles:
            raise SCIMApiError(detail=SCIM_400_INVALID_ORGROLE)

        previous_role = member.role
        previous_restriction = member.flags["idp:role-restricted"]
        member.role = requested_role
        member.flags["idp:role-restricted"] = idp_role_restricted
        member.save()

        # only update metric if the role changed
        if (
            previous_role != organization.default_role
            or previous_restriction != idp_role_restricted
        ):
            metrics.incr("sentry.scim.member.update_role", tags={"organization": organization})

        context = serialize(
            member,
            serializer=_scim_member_serializer_with_expansion(organization),
        )
        return Response(context, status=200)


class SCIMListResponseDict(TypedDict):
    schemas: List[str]
    totalResults: int
    startIndex: int
    itemsPerPage: int
    Resources: List[OrganizationMemberSCIMSerializerResponse]


@region_silo_endpoint
class OrganizationSCIMMemberIndex(SCIMEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)
    public = {"GET", "POST"}

    @extend_schema(
        operation_id="List an Organization's Members",
        parameters=[GlobalParams.ORG_SLUG, SCIMQueryParamSerializer],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SCIMListResponseEnvelopeSCIMMemberIndexResponse", SCIMListResponseDict
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.LIST_ORG_MEMBERS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a paginated list of members bound to a organization with a SCIM Users GET Request.
        """
        # note that SCIM doesn't care about changing results as they're queried

        query_params = self.get_query_parameters(request)

        queryset = OrganizationMember.objects.filter(
            Q(invite_status=InviteStatus.APPROVED.value),
            Q(user_is_active=True, user_id__isnull=False) | Q(user_id__isnull=True),
            organization=organization,
        ).order_by("email", "id")
        if query_params["filter"]:
            filtered_users = user_service.get_many_by_email(
                emails=[query_params["filter"]],
                organization_id=organization.id,
                is_verified=False,
            )
            queryset = queryset.filter(
                Q(email__iexact=query_params["filter"])
                | Q(user_id__in=[u.id for u in filtered_users])
            )  # not including secondary email vals (dups, etc.)

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        def on_results(results):
            results = serialize(
                results,
                None,
                _scim_member_serializer_with_expansion(organization),
            )
            return self.list_api_format(results, queryset.count(), query_params["start_index"])

        return self.paginate(
            request=request,
            on_results=on_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=query_params["count"],
            queryset=queryset,
            cursor_cls=SCIMCursor,
        )

    @extend_schema(
        operation_id="Provision a New Organization Member",
        parameters=[GlobalParams.ORG_SLUG],
        request=inline_serializer(
            name="SCIMMemberProvision",
            fields={
                "userName": serializers.EmailField(),
                "sentryOrgRole": serializers.CharField(required=False),
            },
        ),
        responses={
            201: OrganizationMemberSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.PROVISION_NEW_MEMBER,
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new Organization Member via a SCIM Users POST Request.
        - `userName` should be set to the SAML field used for email, and active should be set to `true`.
        - `sentryOrgRole` can only be `admin`, `manager`, `billing`, or `member`.
        - Sentry's SCIM API doesn't currently support setting users to inactive,
        and the member will be deleted if active is set to `false`.
        - The API also does not support setting secondary emails.
        """
        update_role = False

        with sentry_sdk.start_transaction(
            name="scim.provision_member", op="scim", sampled=True
        ) as txn:
            if "sentryOrgRole" in request.data and request.data["sentryOrgRole"]:
                role = request.data["sentryOrgRole"].lower()
                idp_role_restricted = True
                update_role = True
            else:
                role = organization.default_role
                idp_role_restricted = False
            txn.set_tag("role_restricted", idp_role_restricted)

            # Allow any role as long as it doesn't have `org:admin` permissions
            allowed_roles = {role for role in roles.get_all() if not role.has_scope("org:admin")}

            # Check for roles not found
            # TODO: move this to the serializer verification
            if role not in {role.id for role in allowed_roles}:
                txn.set_tag("invalid_role_selection", True)
                raise SCIMApiError(detail=SCIM_400_INVALID_ORGROLE)

            txn.set_tag("invalid_role_selection", False)
            serializer = OrganizationMemberSerializer(
                data={
                    "email": request.data.get("userName"),
                    "role": roles.get(role).id,
                },
                context={
                    "organization": organization,
                    "allowed_roles": allowed_roles,
                    "allow_existing_invite_request": True,
                },
            )

            if not serializer.is_valid():
                if "email" in serializer.errors and any(
                    ("is already a member" in error) for error in serializer.errors["email"]
                ):
                    # we include conflict logic in the serializer, check to see if that was
                    # our error and if so, return a 409 so the scim IDP knows how to handle
                    raise SCIMApiError(detail=SCIM_409_USER_EXISTS, status_code=409)
                if "role" in serializer.errors:
                    # TODO: Change this to an error pointing to a doc showing the workaround if they
                    # tried to provision an org admin
                    raise SCIMApiError(detail=SCIM_400_INVALID_ORGROLE)
                raise SCIMApiError(detail=json.dumps(serializer.errors))

            result = serializer.validated_data
            with transaction.atomic(router.db_for_write(OrganizationMember)):
                member_query = OrganizationMember.objects.filter(
                    organization=organization, email=result["email"], role=result["role"]
                )

                if member_query.exists():
                    member = member_query.first()
                    if member.token_expired:
                        member.regenerate_token()
                        member.save()
                else:
                    member = OrganizationMember(
                        organization=organization,
                        email=result["email"],
                        role=result["role"],
                        inviter_id=request.user.id,
                    )

                    # TODO: are invite tokens needed for SAML orgs?
                    member.flags["idp:provisioned"] = True
                    member.flags["idp:role-restricted"] = idp_role_restricted
                    if settings.SENTRY_ENABLE_INVITES:
                        member.token = member.generate_token()
                    member.save()

            self.create_audit_entry(
                request=request,
                organization_id=organization.id,
                target_object=member.id,
                data=member.get_audit_log_data(),
                event=audit_log.get_event_id("MEMBER_INVITE")
                if settings.SENTRY_ENABLE_INVITES
                else audit_log.get_event_id("MEMBER_ADD"),
            )

            if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
                member.send_invite_email()
                member_invited.send_robust(
                    member=member,
                    user=request.user,
                    sender=self,
                    referrer=request.data.get("referrer"),
                )

            metrics.incr(
                "sentry.scim.member.provision",
                tags={"organization": organization},
            )
            if update_role:
                metrics.incr("sentry.scim.member.update_role", tags={"organization": organization})

            context = serialize(
                member,
                serializer=_scim_member_serializer_with_expansion(organization),
            )
            return Response(context, status=201)
