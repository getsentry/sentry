from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.scim_examples import SCIMExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.utils.http import absolute_uri

from .constants import SCIM_COUNT, SCIM_SCHEMA_SERVICE_PROVIDER_CONFIG
from .utils import SCIMDiscoveryEndpoint, SCIMMetaResponse


class SCIMFeatureSupportResponse(TypedDict):
    supported: bool


class SCIMBulkConfigResponse(TypedDict):
    supported: bool
    maxOperations: int
    maxPayloadSize: int


class SCIMFilterConfigResponse(TypedDict):
    supported: bool
    maxResults: int


class SCIMAuthenticationSchemeResponse(TypedDict):
    type: str
    name: str
    description: str
    specUri: str
    primary: bool


class SCIMServiceProviderConfigResponse(TypedDict):
    schemas: list[str]
    documentationUri: str
    patch: SCIMFeatureSupportResponse
    bulk: SCIMBulkConfigResponse
    filter: SCIMFilterConfigResponse
    changePassword: SCIMFeatureSupportResponse
    sort: SCIMFeatureSupportResponse
    etag: SCIMFeatureSupportResponse
    authenticationSchemes: list[SCIMAuthenticationSchemeResponse]
    meta: SCIMMetaResponse


def build_service_provider_config(
    organization: Organization,
) -> SCIMServiceProviderConfigResponse:
    return {
        "schemas": [SCIM_SCHEMA_SERVICE_PROVIDER_CONFIG],
        "documentationUri": "https://docs.sentry.io/organization/authentication/sso/",
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        # Only the "eq" operator is supported; see parse_filter_conditions.
        "filter": {"supported": True, "maxResults": SCIM_COUNT},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [
            {
                "type": "oauthbearertoken",
                "name": "OAuth Bearer Token",
                "description": "Authentication scheme using the OAuth Bearer Token standard. Use the SCIM token generated for your organization.",
                "specUri": "https://www.rfc-editor.org/info/rfc6750",
                "primary": True,
            }
        ],
        "meta": {
            "resourceType": "ServiceProviderConfig",
            # Locations use the canonical url-prefix host (like get_scim_url,
            # which is the base URL orgs paste into their IdP) regardless of
            # the host the request came in on.
            "location": absolute_uri(
                f"api/0/organizations/{organization.slug}/scim/v2/ServiceProviderConfig"
            ),
        },
    }


@cell_silo_endpoint
class OrganizationSCIMServiceProviderConfig(SCIMDiscoveryEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getOrganizationScimV2ServiceProviderConfig",
        summary="Retrieve the SCIM Service Provider Configuration",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SCIMServiceProviderConfigResponse", SCIMServiceProviderConfigResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.SERVICE_PROVIDER_CONFIG,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[SCIMServiceProviderConfigResponse]:
        """
        Return the SCIM Service Provider Configuration, which describes the
        SCIM 2.0 protocol features Sentry supports (RFC 7643 section 5).
        """
        self.reject_filter_param(request)
        return Response(build_service_provider_config(organization))
