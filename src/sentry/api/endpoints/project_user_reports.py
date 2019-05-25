from __future__ import absolute_import

from datetime import timedelta
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from uuid import uuid4

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import (
    serialize,
    UserReportWithGroupSerializer,
)
from sentry.api.paginator import DateTimePaginator
from sentry.models import (
    Environment,
    Event,
    EventUser,
    Group,
    GroupStatus,
    ProjectKey,
    UserReport)
from sentry.signals import user_feedback_received
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('CreateUserFeedback')
def create_user_feedback_scenario(runner):
    with runner.isolated_project('Plain Proxy') as project:
        runner.request(
            method='POST',
            path=u'/projects/{}/{}/user-feedback/'.format(runner.org.slug, project.slug),
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


class ProjectUserReportsEndpoint(ProjectEndpoint, EnvironmentMixin):
    authentication_classes = ProjectEndpoint.authentication_classes + (DSNAuthentication,)
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
        # we dont allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        try:
            environment = self._get_environment_from_request(
                request,
                project.organization_id,
            )
        except Environment.DoesNotExist:
            queryset = UserReport.objects.none()
        else:
            queryset = UserReport.objects.filter(
                project=project,
                group__isnull=False,
            ).select_related('group')
            if environment is not None:
                queryset = queryset.filter(
                    environment=environment,
                )

            status = request.GET.get('status', 'unresolved')
            if status == 'unresolved':
                queryset = queryset.filter(
                    group__status=GroupStatus.UNRESOLVED,
                )
            elif status:
                return self.respond({'status': 'Invalid status choice'}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user, UserReportWithGroupSerializer(
                environment_func=self._get_environment_func(
                    request, project.organization_id)
            )),
            paginator_cls=DateTimePaginator,
        )

    @attach_scenarios([create_user_feedback_scenario])
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
        if hasattr(request.auth, 'project_id') and project.id != request.auth.project_id:
            return self.respond(status=400)

        serializer = UserReportSerializer(data=request.DATA)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        report = serializer.object
        # XXX(dcramer): enforce case insensitivty by coercing this to a lowercase string
        report.event_id = report.event_id.lower()
        report.project = project

        # TODO(dcramer): we should probably create the user if they dont
        # exist, and ideally we'd also associate that with the event
        euser = self.find_event_user(report)
        if euser and not euser.name and report.name:
            euser.update(name=report.name)
        if euser:
            report.event_user_id = euser.id

        event = Event.objects.from_event_id(report.event_id, project.id)
        if not event:
            try:
                report.group = Group.objects.from_event_id(project, report.event_id)
            except Group.DoesNotExist:
                pass
        else:
            # if the event is more than 30 minutes old, we dont allow updates
            # as it might be abusive
            if event.datetime < timezone.now() - timedelta(minutes=30):
                return self.respond(
                    {'detail': 'Feedback for this event cannot be modified.'}, status=409)

            report.environment = event.get_environment()
            report.group = event.group

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
            existing_report = UserReport.objects.get(
                project=report.project,
                event_id=report.event_id,
            )

            # if the existing report was submitted more than 5 minutes ago, we dont
            # allow updates as it might be abusive (replay attacks)
            if existing_report.date_added < timezone.now() - timedelta(minutes=5):
                return self.respond(
                    {'detail': 'Feedback for this event cannot be modified.'}, status=409)

            existing_report.update(
                name=report.name,
                email=report.email,
                comments=report.comments,
                date_added=timezone.now(),
                event_user_id=euser.id if euser else None,
            )
            report = existing_report

        else:
            if report.group:
                report.notify()

        user_feedback_received.send(project=report.project, group=report.group, sender=self)

        return self.respond(serialize(report, request.user, UserReportWithGroupSerializer(
            environment_func=self._get_environment_func(
                request, project.organization_id)
        )))

    def find_event_user(self, report):
        try:
            event = Event.objects.get(
                group_id=report.group_id,
                event_id=report.event_id,
            )
        except Event.DoesNotExist:
            if not report.email:
                return None
            try:
                return EventUser.objects.filter(
                    project_id=report.project_id,
                    email=report.email,
                )[0]
            except IndexError:
                return None

        tag = event.get_tag('sentry:user')
        if not tag:
            return None

        try:
            return EventUser.for_tags(
                project_id=report.project_id,
                values=[tag],
            )[tag]
        except KeyError:
            pass
