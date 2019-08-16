from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
from sentry.receivers import check_for_onboarding_complete


class OrganizationOnboardingTaskEndpoint(OrganizationEndpoint):
    def post(self, request, organization):
        try:
            task_id = int(request.data["task"])
        except (TypeError, ValueError):
            return Response(status=500)

        if request.data["status"] == "skipped" and task_id in (
            OnboardingTask.INVITE_MEMBER,
            OnboardingTask.SECOND_PLATFORM,
            OnboardingTask.USER_CONTEXT,
            OnboardingTask.RELEASE_TRACKING,
            OnboardingTask.SOURCEMAPS,
            OnboardingTask.USER_REPORTS,
            OnboardingTask.ISSUE_TRACKER,
            OnboardingTask.NOTIFICATION_SERVICE,
        ):
            rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
                organization=organization,
                user=request.user,
                task=request.data["task"],
                values={"status": OnboardingTaskStatus.SKIPPED, "date_completed": timezone.now()},
            )
            if rows_affected or created:
                check_for_onboarding_complete(organization.id)
            return Response(status=204)

        return Response(status=404)
