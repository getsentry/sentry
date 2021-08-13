from typing import Dict, List, Optional, Sequence

import pytz

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.models.organization import Organization
from sentry.models.release import Release, ReleaseProject
from sentry.utils.http import absolute_uri
from sentry.utils.types import Any

RELEASE_VERSION_CHARS = 12
LATEST_RELEASE_BY_ORG = "Latest release by org:\n"
TOTAL_NEW_ISSUES = "Total new issues: "
RELEASES_FOR = "Releases for "
RELEASES = "Releases"
ORGANIZATIONS_LINK = f"{absolute_uri()}/organizations/"
RELEASES_ROUTE = "/releases/"
PROJECTS_ROUTE = "/projects/"


def pretty_date(time: Any = False) -> str:
    """
    Get a datetime object or a int() Epoch timestamp and return a
    pretty string like 'an hour ago', 'Yesterday', '3 months ago',
    'just now', etc
    """
    from datetime import datetime

    now = datetime.utcnow().replace(tzinfo=pytz.utc)

    if type(time) is int:
        diff = now - datetime.fromtimestamp(time)
    elif isinstance(time, datetime):
        diff = now - time
    elif not time:
        diff = now - now
    second_diff = diff.seconds
    day_diff = diff.days

    if day_diff < 0:
        return ""

    if day_diff == 0:
        if second_diff < 10:
            return "just now"
        if second_diff < 60:
            return f"{second_diff:.1f}" + " seconds ago"
        if second_diff < 120:
            return "a minute ago"
        if second_diff < 3600:
            return f"{second_diff / 60:.1f}" + " minutes ago"
        if second_diff < 7200:
            return "an hour ago"
        if second_diff < 86400:
            return f"{second_diff/3600:.1f}" + " hours ago"
    if day_diff == 1:
        return "Yesterday"
    if day_diff < 7:
        return f"{day_diff:.1f}" + " days ago"
    if day_diff < 31:
        return f"{day_diff/7:.1f}" + " weeks ago"
    if day_diff < 365:
        return f"{day_diff/30:.1f}" + " months ago"
    return f"{day_diff/365:.1f}" + " years ago"


class SlackReleaseMessageBuilder(SlackMessageBuilder):
    def __init__(self, release: Release) -> None:
        super().__init__()
        self.release = release

    def _build_release_link(self, release: Release, org: Organization) -> str:
        """
        Build link for specific Release.
        """
        return f"{self._build_releases_link(org)}{release.version}/"

    def _build_releases_link(self, org: Organization) -> str:
        """
        Build link for releases page.
        """
        return f"{ORGANIZATIONS_LINK}{org.slug}{RELEASES_ROUTE}"

    def _get_new_groups_by_release(self, release: Release) -> int:
        """
        Given a release, returns the number of new issues introduced
        with this release. New issues are called 'new_groups'.
        """
        return sum(self._get_new_groups_by_project(release).values())

    def _get_new_groups_by_project(self, release: Release) -> Dict[ReleaseProject, int]:
        """
        Given a release, returns the number of new issues introduced
        in this release per project.
        """
        return {
            release_project: release_project.new_groups
            for release_project in ReleaseProject.objects.filter(release=release)
        }

    def _build_release_per_org_block(self, release: Release, org: Organization) -> str:
        """
        Given a release and an org, returns a string of slack formatted messages
        with the Org along with its releases with issue data for the releases.

        Returns a string:
        "
        <Org name>

        <Release version>
        <project name>: <number of issues>
        ...
        <Total number of new issues>"
        "
        """
        return f"\n{self._build_org_releases_hyperlink(org)}\n" + self._build_release_for_org_block(
            release, org
        )

    def _build_release_for_org_block(self, release: Release, org: Organization) -> str:
        """
        Given a release and an org, returns a string of slack formatted messages
        with the release version and number of new issues by project along with
        the total number of new issues created in this release. The release
        version is hyperlinked to the release on Sentry.

        Returns a string:
        "<Release version>
        <project name>: <number of issues>
        ...
        <Total number of new issues>"
        """
        return "\n".join(
            [
                f"\n<{self._build_release_link(release, org)}"
                f"|{release.version[:RELEASE_VERSION_CHARS]}>"
            ]
            + self._build_projects_for_release(release, org)
            + [f"{TOTAL_NEW_ISSUES}*{self._get_new_groups_by_release(release)}*"]
        )

    def _build_projects_for_release(self, release: Release, org: Organization) -> List[str]:
        """
        Given a release and an org, returns a list of slack formatted messages
        with the project name and number of issues created for the project
        during this release. The project name is hyperlinked to the project
        on Sentry.

        Returns list of strings:
        [
            "<project name>: <number of issues>",
            ...
        ]
        """
        return [
            f"<{ORGANIZATIONS_LINK}{org.slug}{PROJECTS_ROUTE}{releaseProject.project.slug}"
            f"|{releaseProject.project.name}>: {issues}"
            for releaseProject, issues in self._get_new_groups_by_project(release).items()
        ]

    def _build_org_releases_hyperlink(self, org: Organization) -> str:
        """
        Given an org, creates a hyperlink markdown for the org name
        to link to the releases page for the org.
        """
        return f"<{self._build_releases_link(org)}|*{org.name}*>"

    def build(self) -> SlackBody:
        return self._build(
            text=self._build_release_for_org_block(self.release, self.release.organization),
            actions=build_deploy_buttons([self.release]),
            footer=f"{self.release.organization.name} | {pretty_date(self.release.date_added)}",
        )


def build_deploy_buttons(releases: Sequence[Release]) -> Any:
    buttons = []

    for release in releases:
        for project in release.projects.all():
            project_url = absolute_uri(
                f"/organizations/{project.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy/"
            )
            buttons.append(
                {
                    "text": project.slug,
                    "name": project.slug,
                    "type": "button",
                    "url": project_url,
                }
            )
    return buttons


class SlackReleasesMessageBuilder(SlackMessageBuilder):
    """
    TODO: Figure out Slack block message formatting,
    right now it's just a long string with newlines
    """

    def __init__(
        self,
        org_releases: Optional[Dict[Organization, Release]] = None,
        releases: Optional[List[Release]] = None,
        organization: Optional[Organization] = None,
    ) -> None:
        super().__init__()
        self.org_releases = org_releases
        self.releases = releases
        self.org = organization

    def build_title(self) -> str:
        if self.org_releases:
            return LATEST_RELEASE_BY_ORG
        elif self.releases and self.org:
            return f"{RELEASES_FOR}" f"{self._build_org_releases_hyperlink(self.org)}:"
        return RELEASES

    def _build_releases_link(self, org: Organization) -> str:
        """
        Build link for releases page.
        """
        return f"{ORGANIZATIONS_LINK}{org.slug}{RELEASES_ROUTE}"

    def _build_org_releases_hyperlink(self, org: Organization) -> str:
        """
        Given an org, creates a hyperlink markdown for the org name
        to link to the releases page for the org.
        """
        return f"<{self._build_releases_link(org)}|*{org.name}*>"
