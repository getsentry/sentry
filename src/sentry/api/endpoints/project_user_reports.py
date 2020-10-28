from __future__ import absolute_import

import six
from rest_framework import serializers

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize, UserReportWithGroupSerializer
from sentry.api.paginator import DateTimePaginator
from sentry.models import Environment, GroupStatus, ProjectKey, UserReport
from sentry.ingest.userreport import save_userreport, Conflict


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
        # we dont allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        try:
            environment = self._get_environment_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            queryset = UserReport.objects.none()
        else:
            queryset = UserReport.objects.filter(
                project=project, group__isnull=False
            ).select_related("group")
            if environment is not None:
                queryset = queryset.filter(environment=environment)

            status = request.GET.get("status", "unresolved")
            if status == "unresolved":
                queryset = queryset.filter(group__status=GroupStatus.UNRESOLVED)
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
            return self.respond({"detail": six.text_type(e)}, status=409)

        return self.respond(
            serialize(
                report_instance,
                request.user,
                UserReportWithGroupSerializer(
                    environment_func=self._get_environment_func(request, project.organization_id)
                ),
            )
        )
