from django.db.models import F
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.services.integration import integration_service
from sentry.models.project import Project
from sentry.models.promptsactivity import PromptsActivity
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.platform_categories import REPLAY_PLATFORMS


@region_silo_endpoint
class IssueDetailsBannerEndpoint(ProjectEndpoint):
    """
    This endpoint is used to retrieve information about which banners to show on the issue details page. Any additional banners that are added to the issue details page will have their logic added here.
    Currently, the banners that are shown on the page are: Replays, Setting up Git, and Suspect Commits.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, project: Project, event_id: str) -> Response:
        banners_to_show = []

        organization = project.organization

        # Check if replays are set up
        if project.platform:
            org_has_sent_replays = (
                Project.objects.filter(organization=project.organization)
                .filter(flags=F("flags").bitor(Project.flags.has_replays))
                .exists()
            )
            prompt_dismissed = PromptsActivity.objects.filter(
                organization=organization,
                project=project,
                user_id=request.user.id,
                feature="issue_replay_inline_onboarding",
            ).exists()
            if (
                project.platform in REPLAY_PLATFORMS
                and not org_has_sent_replays
                and not prompt_dismissed
            ):
                banners_to_show.append("replays")

        # Check for Git integrations
        integrations = integration_service.get_integrations(organization_id=project.organization_id)
        has_git_integrations = (
            len(filter(lambda i: i.has_feature(IntegrationFeatures.STACKTRACE_LINK)), integrations)
            > 0
        )

        if not has_git_integrations:
            prompt_dismissed = PromptsActivity.objects.filter(
                organization=organization,
                project=project,
                user_id=request.user.id,
                feature="stacktrace_link",
            ).exists()
            if not prompt_dismissed:
                banners_to_show.append("git_setup")

        # Check for suspect commits
        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        try:
            committers = get_serialized_event_file_committers(
                project, event, frame_limit=int(request.GET.get("frameLimit", 25))
            )

            if len(committers) > 0:
                banners_to_show.append("suspect_commits")
        except Exception:
            pass
        return Response({"banners": banners_to_show})
