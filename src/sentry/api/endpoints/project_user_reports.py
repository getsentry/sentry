from datetime import UTC, datetime, timedelta
from typing import NotRequired, TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import DSNAuthentication
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.user_reports import user_reports_filter_to_unresolved
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import UserReportWithGroupSerializer, serialize
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.models.environment import Environment
from sentry.models.userreport import UserReport
from sentry.utils.dates import epoch


class UserReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReport
        fields = ("name", "email", "comments", "event_id")


class _PaginateKwargs(TypedDict):
    post_query_filter: NotRequired[object]


@region_silo_endpoint
class ProjectUserReportsEndpoint(ProjectEndpoint, EnvironmentMixin):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,  # TODO: deprecate
        "POST": ApiPublishStatus.PRIVATE,  # TODO: deprecate
    }
    authentication_classes = ProjectEndpoint.authentication_classes + (DSNAuthentication,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's User Feedback
        ``````````````````````````````

        Return a list of user feedback items within this project.

        *This list does not include submissions from the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget). This is because it is based on an older format called User Reports - read more [here](https://develop.sentry.dev/application/feedback-architecture/#user-reports).*

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project.
        :auth: required
        """
        # we don't allow read permission with DSNs
        if request.auth is not None and request.auth.kind == "project_key":
            return self.respond(status=401)

        paginate_kwargs: _PaginateKwargs = {}
        try:
            environment = self._get_environment_from_request(request, project.organization_id)
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
                    environment_func=self._get_environment_func(request, project.organization_id)
                ),
            ),
            paginator_cls=DateTimePaginator,
            **paginate_kwargs,
        )

    def post(self, request: Request, project) -> Response:
        """
        Submit User Feedback
        ````````````````````

        *This endpoint is DEPRECATED. We document it here for older SDKs and users who are still migrating to the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget) or [API](https://docs.sentry.io/platforms/javascript/user-feedback/#user-feedback-api)(multi-platform). If you are a new user, do not use this endpoint - unless you don't have a JS frontend, and your platform's SDK does not offer a feedback API.*

        Submit and associate user feedback with an issue.

        Feedback must be received by the server no more than 30 minutes after the event was saved.

        Additionally, within 5 minutes of submitting feedback it may also be overwritten. This is useful
        in situations where you may need to retry sending a request due to network failures.

        If feedback is rejected due to a mutability threshold, a 409 status code will be returned.

        Note: Feedback may be submitted with DSN authentication (see auth documentation).

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project.
        :auth: required
        :param string event_id: the event ID
        :param string name: user's name
        :param string email: user's email address
        :param string comments: comments supplied by user
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
                    environment_func=self._get_environment_func(request, project.organization_id)
                ),
            )
        )
