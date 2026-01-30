from sentry.testutils.cases import TestMigrations


class DeleteDuplicateCommitComparisonsTest(TestMigrations):
    migrate_from = "1022_add_event_id_to_groupopenperiodactivity"
    migrate_to = "1023_add_commitcomparison_unique_constraints"

    def setup_before_migration(self, apps):
        CommitComparison = apps.get_model("sentry", "CommitComparison")

        # Create duplicate records for PR scenario (base_sha present)
        self.cc_pr_1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="owner/repo",
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
        )
        self.cc_pr_2 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="owner/repo",
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
        )

        # Create duplicate records for main branch scenario (base_sha NULL)
        self.cc_main_1 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="owner/repo",
            head_sha="c" * 40,
            base_sha=None,
            provider="github",
        )
        self.cc_main_2 = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="owner/repo",
            head_sha="c" * 40,
            base_sha=None,
            provider="github",
        )

        # Create a unique record that should not be deleted
        self.cc_unique = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_repo_name="owner/other-repo",
            head_sha="d" * 40,
            base_sha="e" * 40,
            provider="github",
        )

    def test(self) -> None:
        from sentry.models.commitcomparison import CommitComparison

        # Verify duplicates were deleted (only oldest ID kept)
        assert not CommitComparison.objects.filter(id=self.cc_pr_2.id).exists()
        assert not CommitComparison.objects.filter(id=self.cc_main_2.id).exists()

        # Verify oldest records were kept
        assert CommitComparison.objects.filter(id=self.cc_pr_1.id).exists()
        assert CommitComparison.objects.filter(id=self.cc_main_1.id).exists()

        # Verify unique record was not deleted
        assert CommitComparison.objects.filter(id=self.cc_unique.id).exists()

        # Verify total count
        assert CommitComparison.objects.filter(organization_id=self.organization.id).count() == 3
