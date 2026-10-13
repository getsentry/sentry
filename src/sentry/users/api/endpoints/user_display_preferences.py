from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.response_types import ValidationErrorResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.users.api.bases.user import UserDisplayPreferencesPermission, UserEndpoint
from sentry.users.api.endpoints.user_details import UserOptionsSerializer
from sentry.users.api.parsers.display_preference import (
    DisplayPreferencesData,
    write_display_preferences,
)
from sentry.users.api.serializers.user import (
    DetailedSelfUserSerializer,
    _UserOptions,  # the canonical response shape for these fields
)
from sentry.users.models.user import User


@extend_schema(tags=["Users"])
@control_silo_endpoint
class UserDisplayPreferencesEndpoint(UserEndpoint):
    """Display preferences only.

    `UserDetailsEndpoint` also writes these, nested under `options`, alongside account
    identity and privilege fields. This endpoint exposes nothing but the display
    preferences, so
    a caller that should only ever change a theme or a timezone can be given this route
    instead of one that can also rename an account or delete it.
    """

    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (UserDisplayPreferencesPermission,)

    @extend_schema(
        operation_id="retrieveUserDisplayPreferences",
        summary="Retrieve a User's Display Preferences",
        responses={
            200: inline_sentry_response_serializer("UserDisplayPreferences", _UserOptions),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, user: User) -> Response[_UserOptions]:
        """
        Return the user's display preferences, with defaults applied for any that are unset.
        """
        return Response(self._serialize_options(user))

    @extend_schema(
        operation_id="updateUserDisplayPreferences",
        summary="Update a User's Display Preferences",
        request=UserOptionsSerializer,
        responses={
            200: inline_sentry_response_serializer("UserDisplayPreferences", _UserOptions),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, user: User
    ) -> Response[_UserOptions] | Response[ValidationErrorResponse]:
        """
        Update the user's display preferences. Only supplied values are changed.
        """
        serializer = UserOptionsSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            errors: ValidationErrorResponse = serializer.errors
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        options: DisplayPreferencesData = serializer.validated_data
        write_display_preferences(user, options)

        return Response(self._serialize_options(user))

    @staticmethod
    def _serialize_options(user: User) -> _UserOptions:
        # Serialized with `user` as its own requester: the serializer only emits the
        # `options` key when it sees the requester as the subject, so this makes that
        # hold whatever `request.user` was built from. The permission class has already
        # confined the request to this user's own options, so the two are the same person.
        serialized = serialize(user, user, DetailedSelfUserSerializer())
        options: _UserOptions = serialized["options"]
        return options
