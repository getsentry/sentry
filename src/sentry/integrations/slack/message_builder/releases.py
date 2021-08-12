from typing import Optional

from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.models.organization import Organization
from sentry.models.release import Release, ReleaseProject
from sentry.utils.http import absolute_uri
from sentry.utils.types import Any

RELEASE_VERSION_CHARS = 12
LATEST_RELEASE_BY_ORG = "Latest release by org:\n"
TOTAL_NEW_ISSUES = "Total new issues: "
RELEASES_FOR = "Releases for "
ORGANIZATIONS_LINK = f"{absolute_uri()}/organizations/"
RELEASES_ROUTE = "/releases/"
PROJECTS_ROUTE = "/projects/"


class SlackReleasesMessageBuilder(BlockSlackMessageBuilder):
    """
    TODO: Figure out Slack block message formatting,
    right now it's just a long string with newlines
    """

    def __init__(
        self,
        org_releases: Optional[dict] = None,
        releases: Optional[list] = None,
        organization: Optional[Organization] = None,
    ) -> None:
        super().__init__()
        self.org_releases = org_releases
        self.releases = releases
        self.org = organization

    def build_str(self) -> Any:
        if self.org_releases:
            blocks = [
                self._build_release_per_org_block(release, org)
                for org, release in self.org_releases.items()
            ]
            return LATEST_RELEASE_BY_ORG + "\n".join(blocks)
        elif self.releases and self.org:
            blocks = [
                self._build_release_for_org_block(release, self.org) for release in self.releases
            ]
            return (
                f"{RELEASES_FOR}"
                f"{self._build_org_releases_hyperlink(self.org)}:\n" + "\n".join(blocks)
            )

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

    def _get_new_groups_by_project(self, release: Release) -> dict:
        """
        Given a release, returns the number of new issues introduced
        in this release per project.
        """
        return {
            releaseProject: releaseProject.new_groups
            for releaseProject in ReleaseProject.objects.filter(release=release)
        }

    def _build_release_per_org_block(self, release: Release, org: Organization):
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

    def _build_release_for_org_block(self, release: Release, org: Organization):
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

    def _build_projects_for_release(self, release: Release, org: Organization):
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

    def _build_org_releases_hyperlink(self, org: Organization):
        """
        Given an org, creates a hyperlink markdown for the org name
        to link to the releases page for the org.
        """
        return f"<{self._build_releases_link(org)}|*{org.name}*>"
