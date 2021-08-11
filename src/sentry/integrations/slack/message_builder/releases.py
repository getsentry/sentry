from typing import Optional

from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.models.organization import Organization
from sentry.models.release import Release, ReleaseProject
from sentry.utils.http import absolute_uri
from sentry.utils.types import Any


class SlackReleasesMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        org_releases: Optional[dict] = None,
        releases: Optional[list] = None,
        organization: Optional[Organization] = None,
    ) -> None:
        super().__init__()
        self.org_releases = org_releases
        self.releases = releases
        self.organization = organization

    def build_str(self) -> Any:
        if self.org_releases:
            blocks = [
                self._build_release_per_org_block(release, org)
                for org, release in self.org_releases.items()
            ]
            return "Latest release by org:\n" + "\n".join(blocks)
        elif self.releases and self.organization:
            blocks = [
                self._build_release_for_org_block(release, self.organization)
                for release in self.releases
            ]
            return f"Releases for {self.organization.name}:\n" + "\n".join(blocks)

    def _build_release_link(self, release: Release, organization: Organization) -> str:
        return f"{absolute_uri()}/organizations/{organization.slug}/releases/{release.version}/"

    def _get_new_groups_by_release(self, release: Release) -> int:
        """
        Given a release, returns the number of new issues introduced
        with this release. New issues are called 'new_groups'.
        """
        new_groups = 0
        for rp in ReleaseProject.objects.filter(release=release):
            new_groups += rp.new_groups
        return new_groups

    def _build_release_per_org_block(self, release: Release, org: Organization):
        return "\n".join([org.name] + self._build_release_for_org_list(release, org))

    def _build_release_for_org_block(self, release: Release, org: Organization):
        return "\n".join(self._build_release_for_org_list(release, org))

    def _build_release_for_org_list(self, release: Release, org: Organization):
        return [
            f"<{self._build_release_link(release, org)}|{release.version[:12]}>",
            f"New Issues: {self._get_new_groups_by_release(release)}",
        ]
