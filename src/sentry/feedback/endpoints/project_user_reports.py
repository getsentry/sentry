from datetime import UTC, datetime, timedelta
from typing import NotRequired, TypedDict

from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import DSNAuthentication
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.environments import get_environment, get_environment_func
from sentry.api.helpers.user_reports import user_reports_filter_to_unresolved
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import UserReportWithGroupSerializer, serialize
from sentry.api.serializers.models.userreport import UserReportWithGroupSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.userreport import Conflict, save_userreport
from sentry.models.environment import Environment
from sentry.models.userreport import UserReport
from sentry.utils.dates import epoch

USER_FEEDBACK_EXAMPLE = {
    "comments": "It broke!",
    "dateCreated": "2018-11-06T21:20:11.468Z",
    "email": "jane@example.com",
    "event": {
        "eventID": "14bad9a2e3774046977a21440ddb39b2",
        "id": "14bad9a2e3774046977a21440ddb39b2",
    },
    "eventID": "14bad9a2e3774046977a21440ddb39b2",
    "id": "1",
    "issue": None,
    "name": "Jane Smith",
    "user": None,
}

USER_FEEDBACK_REQUEST_EXAMPLE = {
    "event_id": "14bad9a2e3774046977a21440ddb39b2",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "comments": "It broke!",
}


class UserReportSerializer(serializers.ModelSerializer):
    event_id = serializers.CharField(
        max_length=32,
        help_text="The event ID. This can be retrieved from the beforeSend callback.",
    )
    name = serializers.CharField(max_length=128, help_text="The user's name.")
    email = serializers.EmailField(max_length=75, help_text="The user's email address.")
    comments = serializers.CharField(max_length=4096, help_text="The user's comments.")

    class Meta:
        model = UserReport
        fields = ("name", "email", "comments", "event_id")


class _PaginateKwargs(TypedDict):
    post_query_filter: NotRequired[object]


_GET_DESCRIPTION = (
    "Return a list of user report feedback items within this project.\n\n"
    "This list does not include submissions from the "
    "[User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget). "
    "Those submissions use the newer feedback format. To return widget feedback, use the "
    "[issue API](https://docs.sentry.io/api/events/list-a-projects-issues/) with the "
    "`issue.category:feedback` filter."
)

_POST_DESCRIPTION = (
    "Submit user report feedback and associate it with an issue.\n\n"
    "This endpoint is deprecated. Prefer the "
    "[User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget) "
    "or the supported SDK feedback APIs for new integrations.\n\n"
    "Feedback must be received no more than 30 minutes after the event was saved. Within "
    "5 minutes of submission, feedback for the same event may be overwritten. If feedback is "
    "rejected due to the mutability threshold, a 409 response is returned.\n\n"
    "Feedback may be submitted with DSN authentication. DSN-authenticated requests return "
    "success without a response body."
)

_STATUS_QUERY_PARAM = OpenApiParameter(
    name="status",
    location="query",
    required=False,
    type=str,
    description=(
        "Filter reports by status. Defaults to `unresolved`; pass an empty value to "
        "return reports in any status."
    ),
)

_ENVIRONMENT_QUERY_PARAM = OpenApiParameter(
    name="environment",
    location="query",
    required=False,
    type=str,
    description="The name of the environment to filter by.",
)

_USER_REPORTS_ALIAS_PARAM = OpenApiParameter(
    name="var",
    location="path",
    required=False,
    type=str,
    description=(
        "Compatibility route segment for `user-feedback` or `user-reports`. "
        "This parameter is removed from the generated public API docs."
    ),
)


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectUserReportsEndpoint(ProjectEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,  # TODO: deprecate
        "POST": ApiPublishStatus.PUBLIC,  # TODO: deprecate
    }
    authentication_classes = ProjectEndpoint.authentication_classes + (DSNAuthentication,)

    @extend_schema(
        operation_id="List a Project's User Feedback",
        description=_GET_DESCRIPTION,
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            _USER_REPORTS_ALIAS_PARAM,
            _ENVIRONMENT_QUERY_PARAM,
            _STATUS_QUERY_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectUserFeedbackResponse",
                list[UserReportWithGroupSerializerResponse],
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Project user feedback",
                value=[USER_FEEDBACK_EXAMPLE],
                response_only=True,
                status_codes=["200"],
            )
        ],
    )
    def get(
        self, request: Request, project
    ) -> Response[list[UserReportWithGroupSerializerResponse]]:
        """
        Return a list of user report feedback items within this project.
        """
        # we don't allow read permission with DSNs
        if request.auth is not None and request.auth.kind == "project_key":
            return self.respond(status=401)

        paginate_kwargs: _PaginateKwargs = {}
        try:
            environment = get_environment(request, project.organization_id)
        except Environment.DoesNotExist:
            queryset = UserReport.objects.none()
        else:
            retention = quotas.backend.get_event_retention(organization=project.organization)
            start = datetime.now(UTC) - timedelta(days=retention) if retention else epoch
            queryset = UserReport.objects.filter(
                project_id=project.id, group_id__isnull=False, date_added__gte=start
            )
            if environment is not None:
                queryset = queryset.filter(environment_id=environment.id)

            status = request.GET.get("status", "unresolved")
            if status == "unresolved":
                paginate_kwargs["post_query_filter"] = user_reports_filter_to_unresolved
            elif status:
                return self.respond({"status": "Invalid status choice"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(
                x,
                request.user,
                UserReportWithGroupSerializer(
                    environment_func=get_environment_func(request, project.organization_id)
                ),
            ),
            paginator_cls=DateTimePaginator,
            **paginate_kwargs,
        )

    @extend_schema(
        operation_id="Submit User Feedback",
        description=_POST_DESCRIPTION,
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            _USER_REPORTS_ALIAS_PARAM,
        ],
        request=UserReportSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectUserFeedbackResponse",
                UserReportWithGroupSerializerResponse,
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Submit user feedback",
                value=USER_FEEDBACK_REQUEST_EXAMPLE,
                request_only=True,
            ),
            OpenApiExample(
                "Submitted user feedback",
                value=USER_FEEDBACK_EXAMPLE,
                response_only=True,
                status_codes=["200"],
            ),
        ],
    )
    def post(
        self, request: Request, project
    ) -> Response[UserReportWithGroupSerializerResponse] | Response[None]:
        """
        Submit user report feedback and associate it with an issue.
        """
        if (
            request.auth is not None
            and request.auth.project_id is not None
            and project.id != request.auth.project_id
        ):
            return self.respond(status=401)

        serializer = UserReportSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        report = serializer.validated_data
        try:
            report_instance = save_userreport(
                project, report, FeedbackCreationSource.USER_REPORT_DJANGO_ENDPOINT
            )
        except Conflict as e:
            return self.respond({"detail": str(e)}, status=409)

        if request.auth is not None and request.auth.kind == "project_key":
            return self.respond(status=200)

        return self.respond(
            serialize(
                report_instance,
                request.user,
                UserReportWithGroupSerializer(
                    environment_func=get_environment_func(request, project.organization_id)
                ),
            )
        )
