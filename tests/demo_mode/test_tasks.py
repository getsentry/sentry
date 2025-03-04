from datetime import datetime, timedelta

from django.utils import timezone

from sentry.demo_mode.tasks import _sync_artifact_bundles
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase


class SyncArtifactBundlesTest(TestCase):

    def setUp(self):
        self.source_org = self.create_organization(slug="source_org")
        self.target_org = self.create_organization(slug="target_org")
        self.unrelated_org = self.create_organization(slug="unrelated_org")

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

    def test_sync_artifact_bundles_no_bundles(self):

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        assert not ArtifactBundle.objects.all().exists()

    def test_sync_artifact_bundles_with_differences(self):
        (source_artifact_bundle, _, __) = self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        target_artifact_bundles = ArtifactBundle.objects.get(organization_id=self.target_org.id)

        assert target_artifact_bundles.bundle_id == source_artifact_bundle.bundle_id

    def test_sync_artifact_bundles_does_not_touch_other_orgs(self):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)
        self.set_up_artifact_bundle(self.unrelated_org, self.unrelated_proj_foo)

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        unrelated_artifact_bundles = ArtifactBundle.objects.filter(
            organization_id=self.unrelated_org.id
        )

        assert unrelated_artifact_bundles.count() == 1

    def test_sync_artifact_bundles_with_old_uploads(self):
        self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo, date_uploaded=timezone.now() - timedelta(days=2)
        )

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        assert not ArtifactBundle.objects.filter(organization_id=self.target_org.id).exists()

    def test_sync_artifact_bundles_only_once(self):
        (source_artifact_bundle, _, __) = self.set_up_artifact_bundle(
            self.source_org, self.source_proj_foo
        )

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)
        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)
        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        target_artifact_bundles = ArtifactBundle.objects.filter(organization_id=self.target_org.id)

        assert target_artifact_bundles.count() == 1
        assert target_artifact_bundles[0].bundle_id == source_artifact_bundle.bundle_id

    def test_sync_project_artifact_bundles(self):
        self.set_up_artifact_bundle(self.source_org, self.source_proj_foo)

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

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

        _sync_artifact_bundles(source_org=self.source_org, target_org=self.target_org)

        target_release_bundle = ReleaseArtifactBundle.objects.get(
            organization_id=self.target_org.id,
        )

        assert target_release_bundle.dist_name == source_release_bundle.dist_name
        assert target_release_bundle.release_name == source_release_bundle.release_name
        assert target_release_bundle.organization_id == self.target_org.id
