from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)

from sentry.models import OnboardingTaskStatus, OrganizationOnboardingTask


class OrganizationOnboardingTaskEndpoint(OrganizationEndpoint):
	permission_classes = [OrganizationPermission, ]

	def post(self, request, organization):
		print request.DATA
		if request.DATA['status'] == 'Skipped':
			print OrganizationOnboardingTask.objects.create_or_update(
				organization=organization,
				user=request.user,
				task=request.DATA['task'],
				values={
					'status': OnboardingTaskStatus.SKIPPED,
					'date_completed': timezone.now(),
				}
			)
			return Response(status=204)

		return "fuck"
