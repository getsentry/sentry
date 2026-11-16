from typing import Annotated, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_TOO_MANY_REQUESTS, RESPONSE_UNAUTHORIZED
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.user_examples import UserExamples
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import has_user, require_user
from sentry.users.api.serializers.user import UserSerializerResponseSelf
from sentry.users.models.user import User


class ApiIndexAuthResponse(TypedDict):
    scopes: Annotated[
        list[str],
        ApiDescription("Scopes stored on the token or API key that authenticated the request"),
    ]


class ApiIndexResponse(TypedDict):
    version: Annotated[str, ApiDescription('API version. Always "0"')]
    auth: Annotated[
        ApiIndexAuthResponse | None,
        ApiDescription(
            "The credentials that authenticated the request, or null for session and anonymous requests"
        ),
    ]
    user: Annotated[
        UserSerializerResponseSelf | None,
        ApiDescription(
            "The authenticated user, or null for anonymous requests and requests made with an API key or organization auth token"
        ),
    ]


@extend_schema(tags=["Users"])
@control_silo_endpoint
class IndexEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = ()

    @extend_schema(
        operation_id="retrieveApiIndex",
        summary="Retrieve the Current Credentials",
        # Authentication is optional: anonymous requests get null `auth` and `user`. The
        # empty requirement marks that. drf-spectacular uses this list as the operation's
        # `security` as is, though its annotation only allows scheme names.
        auth=[{"auth_token": []}, {}],  # type: ignore[list-item]
        responses={
            200: inline_sentry_response_serializer("ApiIndexResponse", ApiIndexResponse),
            401: RESPONSE_UNAUTHORIZED,
            429: RESPONSE_TOO_MANY_REQUESTS,
        },
        examples=UserExamples.RETRIEVE_API_INDEX,
    )
    def get(self, request: Request) -> Response[ApiIndexResponse]:
        """
        Return the API version, the scopes of the token that authenticated the request,
        and the authenticated user. Use it to check which scopes a token has.

        Authentication is optional. `auth` is null unless the request uses a token or API
        key. `user` is null for anonymous requests and for credentials that don't belong
        to a user, such as API keys and organization auth tokens.
        """
        user_data: UserSerializerResponseSelf | None
        if has_user(request.user):
            user = User.objects.get(id=require_user(request).id)
            user_data = serialize(user, user)
        else:
            user_data = None

        auth: ApiIndexAuthResponse | None
        if request.auth:
            get_stored_scopes = getattr(request.auth, "get_stored_scopes", request.auth.get_scopes)
            auth = {"scopes": get_stored_scopes()}
        else:
            auth = None

        context: ApiIndexResponse = {"version": "0", "auth": auth, "user": user_data}
        return Response(context, status=200)
