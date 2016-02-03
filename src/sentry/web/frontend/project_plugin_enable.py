from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
from sentry.plugins import plugins
from sentry.web.frontend.base import ProjectView


class ProjectPluginEnableView(ProjectView):
    required_scope = 'project:write'

    def post(self, request, organization, team, project, slug):
        try:
            plugin = plugins.get(slug)
        except KeyError:
            return self.redirect(reverse('sentry-configure-project-plugin', args=[project.organization.slug, project.slug, slug]))

        if plugin.is_enabled(project):
            return self.redirect(reverse('sentry-configure-project-plugin', args=[project.organization.slug, project.slug, slug]))

        plugin.enable(project=project)

        if slug:
            OrganizationOnboardingTask.objects.get_or_create(
                organization=organization,
                user=request.user,
                task=OnboardingTask.ISSUE_TRACKER,
                defaults={
                    'status': OnboardingTaskStatus.PENDING,
                    'date_completed': timezone.now(),
                    'data': { 'plugin': slug },
                }
            )

        return self.redirect(reverse('sentry-configure-project-plugin', args=[project.organization.slug, project.slug, slug]))
