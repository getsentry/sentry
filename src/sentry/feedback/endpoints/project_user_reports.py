from datetime import UTC, datetime, timedelta
from typing import Any, NotRequired, TypedDict

from drf_spectacular.utils import OpenApiResponse, extend_schema
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
from sentry.api.serializers.models.userreport_with_group import (
    UserReportWithGroupSerializerResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.user_feedback_examples import UserFeedbackExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.userreport import Conflict, save_userreport
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.utils.dates import epoch


class UserReportSerializer(serializers.ModelSerializer[UserReport]):
    class Meta:
        model = UserReport
        fields = ("name", "email", "comments", "event_id")
        extra_kwargs = {
            "event_id": {
                "help_text": "The event ID. This can be retrieved from the [beforeSend callback](https://docs.sentry.io/platforms/javascript/configuration/filtering/#using-beforesend)."
            },
            "name": {"help_text": "User's name."},
            "email": {"help_text": "User's email address."},
            "comments": {"help_text": "Comments supplied by user."},
        }


# drf-spectacular annotates `auth` as strings, but publishes these security requirements as given.
# DSN keys can't read feedback, so GET documents token auth only.
_LIST_AUTH: list[Any] = [{"auth_token": ["project:read"]}]
_SUBMIT_AUTH: list[Any] = [{"auth_token": ["project:write"]}, {"dsn": []}]


class _PaginateKwargs(TypedDict):
    post_query_filter: NotRequired[object]


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectUserReportsEndpoint(ProjectEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    idempotent_methods = frozenset()
    authentication_classes = ProjectEndpoint.authentication_classes + (DSNAuthentication,)

    @extend_schema(
        operation_id="List a Project's User Feedback",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG, CursorQueryParam],
        responses={
            200: OpenApiResponse(
                inline_sentry_response_serializer(
                    "ListProjectUserFeedbackResponse", list[UserReportWithGroupSerializerResponse]
                ),
                description="Success",
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        auth=_LIST_AUTH,
        examples=UserFeedbackExamples.LIST_USER_FEEDBACK,
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[list[UserReportWithGroupSerializerResponse]]:
        """
        Return a list of user feedback items within this project.

        *This list does not include submissions from the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget). This is because it is based on an older format called User Reports - read more [here](https://develop.sentry.dev/application/feedback-architecture/#user-reports). To return a list of user feedback items from the widget, please use the [issue API](https://docs.sentry.io/api/events/list-a-projects-issues/) with the filter `issue.category:feedback`.*
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
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=UserReportSerializer,
        responses={
            200: OpenApiResponse(
                inline_sentry_response_serializer(
                    "SubmitUserFeedbackResponse", UserReportWithGroupSerializerResponse
                ),
                description="Success",
            ),
            400: OpenApiResponse(description="Bad Input"),
            403: RESPONSE_FORBIDDEN,
            404: OpenApiResponse(description="The requested resource does not exist"),
            409: RESPONSE_CONFLICT,
        },
        auth=_SUBMIT_AUTH,
        deprecated=True,
        examples=UserFeedbackExamples.SUBMIT_USER_FEEDBACK,
    )
    def post(
        self, request: Request, project: Project
    ) -> Response[UserReportWithGroupSerializerResponse] | Response[None]:
        """
        *This endpoint is DEPRECATED. We document it here for older SDKs and users who are still migrating to the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget) or [API](https://docs.sentry.io/platforms/javascript/user-feedback/#user-feedback-api)(multi-platform). If you are a new user, do not use this endpoint - unless you don't have a JS frontend, and your platform's SDK does not offer a feedback API.*

        Feedback must be received by the server no more than 30 minutes after the event was saved.

        Additionally, within 5 minutes of submitting feedback it may also be overwritten. This is useful in situations where you may need to retry sending a request due to network failures.

        If feedback is rejected due to a mutability threshold, a 409 status code will be returned.

        Note: Feedback may be submitted with DSN authentication (see auth documentation).
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
