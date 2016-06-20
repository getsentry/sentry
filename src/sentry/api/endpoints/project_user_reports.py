from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from uuid import uuid4

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize, ProjectUserReportSerializer
from sentry.api.paginator import DateTimePaginator
from sentry.models import EventMapping, Group, GroupStatus, UserReport
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('CreateUserFeedback')
def create_user_feedback_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(
            method='POST',
            path='/projects/{}/{}/user-feedback/'.format(runner.org.slug, project.slug),
            data={
                'name': 'Jane Smith',
                'email': 'jane@example.com',
                'comments': 'It broke!',
                'event_id': uuid4().hex,
            }
        )


class UserReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReport
        fields = ('name', 'email', 'comments', 'event_id')


class ProjectUserReportsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project):
        """
        List a Project's User Feedback
        ``````````````````````````````

        Return a list of user feedback items within this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        """
        queryset = UserReport.objects.filter(
            project=project,
            group__isnull=False,
        ).select_related('group')

        status = request.GET.get('status', 'unresolved')
        if status == 'unresolved':
            queryset = queryset.filter(
                group__status=GroupStatus.UNRESOLVED,
            )
        elif status:
            return Response({'status': 'Invalid status choice'}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user, ProjectUserReportSerializer()),
            paginator_cls=DateTimePaginator,
        )

    @attach_scenarios([create_user_feedback_scenario])
    def post(self, request, project):
        """
        Submit User Feedback
        ````````````````````

        Submit and associate user feedback with an issue.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :auth: required
        :param string event_id: the event ID
        :param string name: user's name
        :param string email: user's email address
        :param string comments: comments supplied by user
        """
        serializer = UserReportSerializer(data=request.DATA)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        report = serializer.object
        report.project = project
        try:
            mapping = EventMapping.objects.get(
                event_id=report.event_id,
                project_id=project.id,
            )
        except EventMapping.DoesNotExist:
            # XXX(dcramer): the system should fill this in later
            pass
        else:
            report.group = Group.objects.get(id=mapping.group_id)

        try:
            with transaction.atomic():
                report.save()
        except IntegrityError:
            # There was a duplicate, so just overwrite the existing
            # row with the new one. The only way this ever happens is
            # if someone is messing around with the API, or doing
            # something wrong with the SDK, but this behavior is
            # more reasonable than just hard erroring and is more
            # expected.
            report = UserReport.objects.get(
                project=report.project,
                event_id=report.event_id,
            )
            report.update(
                name=report.name,
                email=report.email,
                comments=report.comments,
                date_added=timezone.now(),
            )

        return Response(serialize(report, request.user, ProjectUserReportSerializer()))
