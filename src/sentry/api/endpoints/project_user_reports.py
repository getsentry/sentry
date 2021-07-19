from rest_framework import serializers

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.user_reports import user_reports_filter_to_unresolved
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import UserReportWithGroupSerializer, serialize
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.models import Environment, ProjectKey, UserReport


class UserReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReport
        fields = ("name", "email", "comments", "event_id")


class ProjectUserReportsEndpoint(ProjectEndpoint, EnvironmentMixin):
    authentication_classes = ProjectEndpoint.authentication_classes + (DSNAuthentication,)

    def get(self, request, project):
        """
        List a Project's User Feedback
        ``````````````````````````````

        Return a list of user feedback items within this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        """
        # we don't allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        paginate_kwargs = {}
        try:
            environment = self._get_environment_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            queryset = UserReport.objects.none()
        else:
            queryset = UserReport.objects.filter(project_id=project.id, group_id__isnull=False)
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

    def post(self, request, project):
        """
        Submit User Feedback
        ````````````````````

        Submit and associate user feedback with an issue.

        Feedback must be received by the server no more than 30 minutes after the event was saved.

        Additionally, within 5 minutes of submitting feedback it may also be overwritten. This is useful
        in situations where you may need to retry sending a request due to network failures.

        If feedback is rejected due to a mutability threshold, a 409 status code will be returned.

        Note: Feedback may be submitted with DSN authentication (see auth documentation).

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        :param string event_id: the event ID
        :param string name: user's name
        :param string email: user's email address
        :param string comments: comments supplied by user
        """
        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            return self.respond(status=400)

        serializer = UserReportSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        report = serializer.validated_data
        try:
            report_instance = save_userreport(project, report)
        except Conflict as e:
            return self.respond({"detail": str(e)}, status=409)

        if isinstance(request.auth, ProjectKey):
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
