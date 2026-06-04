from sentry.issues.services.issue.impl import DatabaseBackedIssueService
from sentry.models.groupshare import GroupShare
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class GetSharedForOrgTest(TestCase):
    def setUp(self) -> None:
        self.service = DatabaseBackedIssueService()
        self.group = self.create_group(project=self.project)
        self.share = GroupShare.objects.create(
            project=self.group.project,
            group=self.group,
            user_id=self.user.id,
        )

    def test_returns_metadata_when_sharing_enabled(self) -> None:
        result = self.service.get_shared_for_org(
            slug=self.organization.slug, share_id=str(self.share.uuid)
        )
        assert result is not None
        assert result.title == self.group.title

    def test_returns_none_when_sharing_disabled_on_owner_org(self) -> None:
        self.organization.flags.disable_shared_issues = True
        self.organization.save()
        result = self.service.get_shared_for_org(
            slug=self.organization.slug, share_id=str(self.share.uuid)
        )
        assert result is None

    def test_returns_none_when_slug_does_not_match_share_owner(self) -> None:
        # The share UUID belongs to self.organization, but the request uses a different org's slug.
        # This is the cross-org bypass: must be rejected regardless of the other org's flag.
        other_org = self.create_organization(name="Other Org")
        result = self.service.get_shared_for_org(slug=other_org.slug, share_id=str(self.share.uuid))
        assert result is None

    def test_returns_none_when_slug_mismatch_and_owner_has_sharing_disabled(self) -> None:
        # Org A (owner) has disabled sharing. Attacker uses org B's slug with org A's share UUID.
        self.organization.flags.disable_shared_issues = True
        self.organization.save()
        other_org = self.create_organization(name="Other Org")
        result = self.service.get_shared_for_org(slug=other_org.slug, share_id=str(self.share.uuid))
        assert result is None

    def test_returns_none_for_unknown_slug(self) -> None:
        result = self.service.get_shared_for_org(
            slug="nonexistent-org", share_id=str(self.share.uuid)
        )
        assert result is None

    def test_returns_none_for_unknown_share_id(self) -> None:
        result = self.service.get_shared_for_org(
            slug=self.organization.slug, share_id="00000000-0000-0000-0000-000000000000"
        )
        assert result is None
