from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid1

from django.db.utils import IntegrityError
from django.utils import timezone

from sentry.demo_mode.tasks import (
    _sync_artifact_bundles,
    _sync_proguard_artifact_releases,
    _sync_project_debug_files,
)
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.debugfile import ProguardArtifactRelease, ProjectDebugFile
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class SyncArtifactBundlesTest(TestCase):

    def setUp(self):
        self.source_org = self.create_organization(slug="source_org")
        self.target_org = self.create_organization(slug="target_org")
        self.unrelated_org = self.create_organization(slug="unrelated_org")
        self.empty_org = self.create_organization(slug="empty_org")

        self.source_proj_foo = self.create_project(organization=self.source_org, slug="foo")
        self.target_proj_foo = self.create_project(organization=self.target_org, slug="foo")
        self.unrelated_proj_foo = self.create_project(organization=self.unrelated_org, slug="foo")

        self.source_proj_bar = self.create_project(organization=self.source_org, slug="bar")
        self.target_proj_baz = self.create_project(organization=self.target_org, slug="baz")

    def set_up_artifact_bundle(
        self,
        organization: Organization,
        project: Project,
        date_uploaded: datetime | None = None,
    ):
        date_uploaded = date_uploaded or timezone.now()
        artifact_bundle = self.create_artifact_bundle(org=organization, date_uploaded=date_uploaded)
        project_artifact_bundle = ProjectArtifactBundle.objects.create(
            organization_id=organization.id,
            project_id=project.id,
            artifact_bundle_id=artifact_bundle.id,
        )

        release_artifact_bundle = ReleaseArtifactBundle.objects.create(
            organization_id=organization.id,
            artifact_bundle_id=artifact_bundle.id,
            dist_name="dist",
            release_name="release",
        )

        return artifact_bundle, project_artifact_bundle, release_artifact_bundle

    def set_up_proguard_artifact_release(
        self,
        organization: Organization,
        project: Project,
        date_added: datetime | None = None,
    ):
        date_added = date_added or timezone.now()
        proguard_artifact_release = ProguardArtifactRelease.objects.create(
            organization_id=organization.id,
            project_id=project.id,
            release_name="release",
            proguard_uuid=uuid1(),
            project_debug_file=self.create_dif_file(project),
            date_added=date_added,
        )
        return proguard_artifact_release

    def last_three_days(self):
        return timezone.now() - timedelta(days=3)

    def test_sync_artifact_bundles_no_bundles(self):

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        assert not ArtifactBundle.objects.all().exists()

    def test_sync_artifact_bundles_with_differences(self):
        (source_artifact_bundle, _, __) = self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_artifact_bundles = ArtifactBundle.objects.get(organization_id=self.target_org.id)

        assert target_artifact_bundles.bundle_id == source_artifact_bundle.bundle_id

    def test_sync_artifact_bundles_does_not_touch_other_orgs(self):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)
        self.set_up_artifact_bundle(self.unrelated_org, self.unrelated_proj_foo)

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        unrelated_artifact_bundles = ArtifactBundle.objects.filter(
            organization_id=self.unrelated_org.id
        )

        assert unrelated_artifact_bundles.count() == 1

    def test_sync_artifact_bundles_with_old_uploads(self):
        self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo, date_uploaded=timezone.now() - timedelta(days=2)
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=timezone.now() - timedelta(days=1),
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

    def test_sync_artifact_bundles_only_once(self):
        (source_artifact_bundle, _, __) = self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo
        )

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )
        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )
        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_artifact_bundles = ArtifactBundle.objects.filter(organization_id=self.target_org.id)

        assert target_artifact_bundles.count() == 1
        assert target_artifact_bundles[0].bundle_id == source_artifact_bundle.bundle_id

    def test_sync_artifact_bundles_with_empty_org_does_not_fail(self):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.empty_org,
            cutoff_date=self.last_three_days(),
        )

    def test_sync_project_artifact_bundles(self):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_project_artifact_bundle = ProjectArtifactBundle.objects.get(
            organization_id=self.target_org.id,
            project_id=self.target_proj_foo.id,
        )

        assert target_project_artifact_bundle.project_id == self.target_proj_foo.id
        assert target_project_artifact_bundle.organization_id == self.target_org.id

    def test_sync_release_artifact_bundles(self):
        (_, __, source_release_bundle) = self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo
        )

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_release_bundle = ReleaseArtifactBundle.objects.get(
            organization_id=self.target_org.id,
        )

        assert target_release_bundle.dist_name == source_release_bundle.dist_name
        assert target_release_bundle.release_name == source_release_bundle.release_name
        assert target_release_bundle.organization_id == self.target_org.id

    @mock.patch("sentry.demo_mode.tasks._sync_release_artifact_bundle", side_effect=IntegrityError)
    def test_sync_artifact_bundles_rolls_back_on_error(self, _):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()
        assert not ProjectArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()
        assert not ReleaseArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

    def test_sync_project_debug_files(self):
        source_project_debug_file = self.create_dif_file(self.source_proj_foo)

        assert not ProjectDebugFile.objects.filter(
            project_id=self.target_proj_foo.id,
            debug_id=source_project_debug_file.debug_id,
        ).exists()

        _sync_project_debug_files(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_project_debug_file = ProjectDebugFile.objects.get(
            project_id=self.target_proj_foo.id,
            debug_id=source_project_debug_file.debug_id,
        )

        assert target_project_debug_file.debug_id == source_project_debug_file.debug_id
        assert target_project_debug_file.code_id == source_project_debug_file.code_id
        assert target_project_debug_file.cpu_name == source_project_debug_file.cpu_name

    def test_sync_project_debug_files_with_old_uploads(self):
        source_project_debug_file = self.create_dif_file(
            self.source_proj_foo,
            date_accessed=timezone.now() - timedelta(days=2),
        )

        assert not ProjectDebugFile.objects.filter(
            project_id=self.target_proj_foo.id,
            debug_id=source_project_debug_file.debug_id,
        ).exists()

        _sync_project_debug_files(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        assert ProjectDebugFile.objects.filter(
            project_id=self.target_proj_foo.id,
            debug_id=source_project_debug_file.debug_id,
        ).exists()

    def test_sync_project_debug_files_with_empty_org_does_not_fail(self):
        self.create_dif_file(self.source_proj_foo)

        _sync_project_debug_files(
            source_org=self.source_org,
            target_org=self.empty_org,
            cutoff_date=self.last_three_days(),
        )

    def test_sync_proguard_artifact_releases(self):
        source_proguard_artifact_release = self.set_up_proguard_artifact_release(
            self.source_org,
            self.source_proj_foo,
        )

        assert not ProguardArtifactRelease.objects.filter(
            organization_id=self.target_org.id,
            proguard_uuid=source_proguard_artifact_release.proguard_uuid,
        ).exists()

        _sync_proguard_artifact_releases(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        target_proguard_artifact_release = ProguardArtifactRelease.objects.get(
            organization_id=self.target_org.id,
            proguard_uuid=source_proguard_artifact_release.proguard_uuid,
        )

        assert (
            target_proguard_artifact_release.release_name
            == source_proguard_artifact_release.release_name
        )
        assert (
            target_proguard_artifact_release.proguard_uuid
            == source_proguard_artifact_release.proguard_uuid
        )
        assert target_proguard_artifact_release.project_id == self.target_proj_foo.id

    def test_sync_proguard_artifact_releases_with_old_uploads(self):
        source_proguard_artifact_release = self.set_up_proguard_artifact_release(
            self.source_org,
            self.source_proj_foo,
            date_added=timezone.now() - timedelta(days=2),
        )

        assert not ProguardArtifactRelease.objects.filter(
            organization_id=self.target_org.id,
            proguard_uuid=source_proguard_artifact_release.proguard_uuid,
        ).exists()

        _sync_artifact_bundles(
            source_org=self.source_org,
            target_org=self.target_org,
            cutoff_date=self.last_three_days(),
        )

        assert not ProguardArtifactRelease.objects.filter(
            organization_id=self.target_org.id,
            proguard_uuid=source_proguard_artifact_release.proguard_uuid,
        ).exists()

    def test_sync_proguard_artifact_releases_with_empty_org_does_not_fail(self):
        self.set_up_proguard_artifact_release(self.source_org, self.source_proj_foo)

        _sync_proguard_artifact_releases(
            source_org=self.source_org,
            target_org=self.empty_org,
            cutoff_date=self.last_three_days(),
        )
