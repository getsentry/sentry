from typing import Any, Dict, Union

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import (
    OpenApiExample,
    extend_schema,
    extend_schema_field,
    inline_serializer,
)
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.fields import Field
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organizationmember import OrganizationMemberEndpoint
from sentry.api.endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from sentry.api.endpoints.organization_member_index import OrganizationMemberSerializer
from sentry.api.exceptions import ConflictError
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import (
    OrganizationMemberSCIMSerializer,
    OrganizationMemberSCIMSerializerResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.decorators import public
from sentry.apidocs.parameters import GLOBAL_PARAMS, SCIM_PARAMS
from sentry.auth.providers.saml2.activedirectory.apps import ACTIVE_DIRECTORY_PROVIDER_NAME
from sentry.models import (
    AuditLogEntryEvent,
    AuthIdentity,
    AuthProvider,
    InviteStatus,
    OrganizationMember,
)
from sentry.signals import member_invited
from sentry.utils import json
from sentry.utils.cursors import SCIMCursor

from .constants import SCIM_400_INVALID_PATCH, SCIM_409_USER_EXISTS, SCIM_API_ERROR, MemberPatchOps
from .utils import (
    OrganizationSCIMMemberPermission,
    SCIMEndpoint,
    SCIMQueryParamSerializer,
    scim_response_envelope,
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
        else:
            raise ValidationError("value must be a boolean or object")

    def to_internal_value(self, data) -> Union[Dict, bool]:
        if isinstance(data, bool):
            return data
        elif isinstance(data, dict):
            return data
        else:
            raise ValidationError("value must be a boolean or object")


class SCIMPatchOperationSerializer(serializers.Serializer):
    op = serializers.ChoiceField(choices=("replace",), required=True)
    value = OperationValue()
    path = serializers.CharField(required=False)


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
    auth_provider = AuthProvider.objects.get(organization=organization)
    expand = ["active"]

    if auth_provider.provider == ACTIVE_DIRECTORY_PROVIDER_NAME:
        expand = []
    return OrganizationMemberSCIMSerializer(expand=expand)


@public(methods={"GET", "DELETE", "PATCH"})
class OrganizationSCIMMemberDetails(SCIMEndpoint, OrganizationMemberEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)

    def _delete_member(self, request: Request, organization, member):
        audit_data = member.get_audit_log_data()
        if OrganizationMemberDetailsEndpoint.is_only_owner(member):
            raise PermissionDenied(detail=ERR_ONLY_OWNER)
        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=member.user, auth_provider__organization=organization
            ).delete()
            member.delete()
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=member.id,
                target_user=member.user,
                event=AuditLogEntryEvent.MEMBER_REMOVE,
                data=audit_data,
            )

    def _should_delete_member(self, operation):
        if operation["op"].lower() == MemberPatchOps.REPLACE:
            if isinstance(operation["value"], dict) and operation["value"]["active"] is False:
                # how okta sets active to false
                return True
            elif operation["path"] == "active" and operation["value"] is False:
                # how other idps set active to false
                return True
        return False

    @extend_schema(
        operation_id="Query an Individual Organization Member",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIM_PARAMS.MEMBER_ID],
        request=None,
        responses={
            200: OrganizationMemberSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "Successful response",
                value={
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": "102",
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                },
                status_codes=["200"],
            ),
        ],
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
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIM_PARAMS.MEMBER_ID],
        request=SCIMPatchRequestSerializer,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "Set member inactive",
                value={
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                    "Operations": [{"op": "replace", "value": {"active": False}}],
                },
                status_codes=["204"],
            ),
        ],
    )
    def patch(self, request: Request, organization, member):
        """
        Update an organization member's attributes with a SCIM PATCH Request.
        The only supported attribute is `active`. After setting `active` to false
        Sentry will permanently delete the Organization Member.
        """

        serializer = SCIMPatchRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"schemas": SCIM_API_ERROR, "detail": json.dumps(serializer.errors)}, status=400
            )

        result = serializer.validated_data

        for operation in result["operations"]:
            # we only support setting active to False which deletes the orgmember
            if self._should_delete_member(operation):
                self._delete_member(request, organization, member)
                return Response(status=204)
            else:
                return Response(SCIM_400_INVALID_PATCH, status=400)

        context = serialize(
            member,
            serializer=_scim_member_serializer_with_expansion(organization),
        )
        return Response(context)

    @extend_schema(
        operation_id="Delete an Organization Member",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIM_PARAMS.MEMBER_ID],
        request=None,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def delete(self, request: Request, organization, member) -> Response:
        """
        Delete an organization member with a SCIM User DELETE Request.
        """
        self._delete_member(request, organization, member)
        return Response(status=204)


@public(methods={"GET", "POST"})
class OrganizationSCIMMemberIndex(SCIMEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)

    @extend_schema(
        operation_id="List an Organization's Members",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIMQueryParamSerializer],
        request=None,
        responses={
            200: scim_response_envelope(
                "SCIMMemberIndexResponse", OrganizationMemberSCIMSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "List an Organization's Members",
                value={
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                    "totalResults": 1,
                    "startIndex": 1,
                    "itemsPerPage": 1,
                    "Resources": [
                        {
                            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                            "id": "102",
                            "userName": "test.user@okta.local",
                            "emails": [
                                {"primary": True, "value": "test.user@okta.local", "type": "work"}
                            ],
                            "name": {"familyName": "N/A", "givenName": "N/A"},
                            "active": True,
                            "meta": {"resourceType": "User"},
                        }
                    ],
                },
                status_codes=["200"],
            ),
        ],
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a paginated list of members bound to a organization with a SCIM Users GET Request.
        """
        # note that SCIM doesn't care about changing results as they're queried

        query_params = self.get_query_parameters(request)

        queryset = (
            OrganizationMember.objects.filter(
                Q(invite_status=InviteStatus.APPROVED.value),
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
            )
            .select_related("user")
            .order_by("email", "user__email")
        )
        if query_params["filter"]:
            queryset = queryset.filter(
                Q(email__iexact=query_params["filter"])
                | Q(user__email__iexact=query_params["filter"])
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
        parameters=[GLOBAL_PARAMS.ORG_SLUG],
        request=inline_serializer(
            "SCIMMemberProvision", fields={"userName": serializers.EmailField()}
        ),
        responses={
            201: OrganizationMemberSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "Provision new member",
                response_only=True,
                value={
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": "242",
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "active": True,
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "meta": {"resourceType": "User"},
                },
                status_codes=["201"],
            ),
        ],
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new Organization Member via a SCIM Users POST Request.
        - `userName` should be set to the SAML field used for email, and active should be set to `true`.
        - Sentry's SCIM API doesn't currently support setting users to inactive,
        and the member will be deleted if inactive is set to `false`.
        - The API also does not support setting secondary emails.
        """

        serializer = OrganizationMemberSerializer(
            data={
                "email": request.data.get("userName"),
                "role": roles.get(organization.default_role).id,
            },
            context={
                "organization": organization,
                "allowed_roles": [roles.get(organization.default_role)],
                "allow_existing_invite_request": True,
            },
        )

        if not serializer.is_valid():
            if "email" in serializer.errors and any(
                ("is already a member" in error) for error in serializer.errors["email"]
            ):
                # we include conflict logic in the serializer, check to see if that was
                # our error and if so, return a 409 so the scim IDP knows how to handle
                raise ConflictError(detail=SCIM_409_USER_EXISTS)
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        with transaction.atomic():
            member = OrganizationMember(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter=request.user,
            )

            # TODO: are invite tokens needed for SAML orgs?
            if settings.SENTRY_ENABLE_INVITES:
                member.token = member.generate_token()
            member.save()

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=member.id,
            data=member.get_audit_log_data(),
            event=AuditLogEntryEvent.MEMBER_INVITE
            if settings.SENTRY_ENABLE_INVITES
            else AuditLogEntryEvent.MEMBER_ADD,
        )

        if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
            member.send_invite_email()
            member_invited.send_robust(
                member=member,
                user=request.user,
                sender=self,
                referrer=request.data.get("referrer"),
            )

        context = serialize(
            member,
            serializer=_scim_member_serializer_with_expansion(organization),
        )
        return Response(context, status=201)
