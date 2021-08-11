import abc
from typing import Any, Sequence, Tuple

from django.db.models import F, QuerySet
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_group_index import inbox_search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.inbox import (
    SlackIssuesHelpMessageBuilder,
    get_issues_message,
)
from sentry.integrations.slack.requests.base import SlackRequest
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.models import Organization, Project, Release
from sentry.models.release import ReleaseProject
from sentry.utils.types import Bool

LINK_USER_MESSAGE = (
    "<{associate_url}|Link your Slack identity> to your Sentry account to receive notifications. "
    "You'll also be able to perform actions in Sentry through Slack. "
)
UNLINK_USER_MESSAGE = "<{associate_url}|Click here to unlink your identity.>"
NOT_LINKED_MESSAGE = "You do not have a linked identity to unlink."
ALREADY_LINKED_MESSAGE = "You are already linked as `{username}`."
FEATURE_FLAG_MESSAGE = "This feature hasn't been released yet, hang tight."


class SlackDMEndpoint(Endpoint, abc.ABC):  # type: ignore
    def post_dispatcher(self, request: SlackRequest) -> Any:
        """
        All Slack commands are handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        command, args = self.get_command_and_args(request)

        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())

        integration = request.integration
        organization = integration.organizations.all()[0]
        if command in ["link", "unlink"] and not features.has(
            "organizations:notification-platform", organization
        ):
            return self.reply(request, FEATURE_FLAG_MESSAGE)

        if command == "link":
            if not args:
                return self.link_user(request)

            if args[0] == "team":
                return self.link_team(request)

        if command == "unlink":
            if not args:
                return self.unlink_user(request)

            if args[0] == "team":
                return self.unlink_team(request)

        if command == "issues":
            # Everything else will fall through to "unknown command". Should I
            # catch it with a better help message?
            if not args or args[0] == "help":
                return self.respond(SlackIssuesHelpMessageBuilder(" ".join(args)).build())

            if args[0] == "inbox":
                return self.get_inbox(request)

            if args[0] == "triage":
                return self.get_inbox(request)

        if command == "releases":
            if not args:
                return self.get_releases(request)
            else:
                return self.get_releases_by_org(request, args[0])

        # If we cannot interpret the command, print help text.
        request_data = request.data
        unknown_command = request_data.get("text", "").lower()
        return self.respond(SlackHelpMessageBuilder(unknown_command).build())

    def get_command_and_args(self, request: SlackRequest) -> Tuple[str, Sequence[str]]:
        raise NotImplementedError

    def reply(self, slack_request: SlackRequest, message: str) -> Response:
        raise NotImplementedError

    def link_user(self, slack_request: SlackRequest) -> Any:
        if slack_request.has_identity:
            return self.reply(
                slack_request, ALREADY_LINKED_MESSAGE.format(username=slack_request.identity_str)
            )

        integration = slack_request.integration
        organization = integration.organizations.all()[0]
        associate_url = build_linking_url(
            integration=integration,
            organization=organization,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, LINK_USER_MESSAGE.format(associate_url=associate_url))

    def unlink_user(self, slack_request: SlackRequest) -> Any:
        if not slack_request.has_identity:
            return self.reply(slack_request, NOT_LINKED_MESSAGE)

        integration = slack_request.integration
        organization = integration.organizations.all()[0]
        associate_url = build_unlinking_url(
            integration_id=integration.id,
            organization_id=organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, UNLINK_USER_MESSAGE.format(associate_url=associate_url))

    def get_issues(self, slack_request: SlackRequest) -> Any:
        """There could be a timeout so consider just sending a message like: "preparing your issues"."""
        issues = []
        if slack_request.has_identity:
            user_id = slack_request.identity_id
            projects = Project.objects.get_for_user_ids([user_id])
            if projects:
                issues = inbox_search(
                    projects,
                    search_filters=[
                        SearchFilter(
                            key=SearchKey(name="status"),
                            operator="=",
                            value=SearchValue(raw_value=0),
                        ),
                        SearchFilter(
                            key=SearchKey(name="for_review"),
                            operator="=",
                            value=SearchValue(raw_value=1),
                        ),
                    ],
                )

        return self.reply(slack_request, get_issues_message(issues))

    def get_triage(self, slack_request: SlackRequest) -> Any:
        return self.get_issues(slack_request)

    def get_inbox(self, slack_request: SlackRequest) -> Any:
        return self.get_issues(slack_request)

    def link_team(self, slack_request: SlackRequest) -> Any:
        raise NotImplementedError

    def unlink_team(self, slack_request: SlackRequest) -> Any:
        raise NotImplementedError

    def get_releases(self, slack_request: SlackRequest) -> Any:

        orgs = self._get_orgs_by_user_id(slack_request)

        org_releases = {}
        for org in orgs:
            release = Release.objects.filter(organization=org).latest("date_added")
            org_releases[org.name] = [release.version, self._get_new_groups_by_release(release)]

        return self.reply(slack_request, f"Latest release per org: {org_releases}")

    def get_releases_by_org(self, slack_request: SlackRequest, org_slug: str) -> Any:

        if self._user_exists_in_org(slack_request, org_slug):
            org = Organization.objects.get(slug=org_slug)
            releases = (
                Release.objects.filter(organization=org)
                .annotate(
                    date=F("date_added"),
                )
                .order_by("-date")
                .distinct()[:5]
            )
            releases_formatted = [
                [release.version, self._get_new_groups_by_release(release)] for release in releases
            ]
            return self.reply(slack_request, f"Releases for {org_slug}: {releases_formatted}")
        else:
            return self.reply(slack_request, f"Org '{org_slug}' not found!")

    def _user_exists_in_org(self, slack_request: SlackRequest, org_slug: str) -> Bool:
        user_orgs = self._get_orgs_by_user_id(slack_request)
        for user_org in user_orgs:
            if user_org.slug == org_slug:
                return True
        return False

    def _get_orgs_by_user_id(self, slack_request: SlackRequest) -> QuerySet:
        return Organization.objects.get_for_user_ids({slack_request.identity_id})

    def _get_new_groups_by_release(self, release: Release) -> int:
        """
        Given a release, returns the number of new issues introduced
        with this release. New issues are called 'new_groups'.
        """
        new_groups = 0
        for rp in ReleaseProject.objects.filter(release=release):
            new_groups += rp.new_groups
        return new_groups
