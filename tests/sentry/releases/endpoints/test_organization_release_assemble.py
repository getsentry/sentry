from hashlib import sha1
from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import ChunkFileState, assemble_artifacts
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class OrganizationReleaseAssembleTest(APITestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.team = self.create_team(organization=self.organization)
        self.release = self.create_release(version="my-unique-release.1")
        self.url = reverse(
            "sentry-api-0-organization-release-assemble",
            args=[self.organization.slug, self.release.version],
        )

    def test_assemble_json_schema(self) -> None:
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": "invalid"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble(self, mock_assemble_artifacts: MagicMock) -> None:
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "version": self.release.version,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
                "project_ids": [self.project.id],
                "is_release_bundle_migration": True,
            }
        )

    def test_assemble_response(self) -> None:
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            project_ids=[self.project.id],
            is_release_bundle_migration=True,
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.OK

    def test_dif_error_response(self) -> None:
        bundle_file = b"invalid"
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            project_ids=[self.project.id],
            is_release_bundle_migration=True,
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.ERROR

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble_as_artifact_bundle(self, mock_assemble_artifacts: MagicMock) -> None:
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        # assert that we are uploading as artifact bundle
        kwargs = {
            "org_id": self.organization.id,
            "version": self.release.version,
            "checksum": total_checksum,
            "chunks": [blob1.checksum],
            "project_ids": [self.project.id],
            "is_release_bundle_migration": True,
        }
        mock_assemble_artifacts.apply_async.assert_called_once_with(kwargs=kwargs)
        # actually call through to assemble :-)
        assemble_artifacts(**kwargs)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.OK

        # make sure that we have an artifact bundle now
        artifact_bundles = ArtifactBundle.objects.filter(
            organization_id=self.organization.id,
        )
        assert len(artifact_bundles) == 1

    def test_manifest_project_cannot_escalate_to_unauthorized_project(self) -> None:
        """
        Test that a malicious manifest.json cannot specify a project the user
        doesn't have access to. This prevents IDOR attacks where an attacker
        could upload artifact bundles to arbitrary projects in the organization.
        """
        from sentry.models.artifactbundle import ProjectArtifactBundle

        # Create 3 projects on the release (to trigger the > 2 projects optimization)
        project_a = self.create_project(name="project-a", teams=[self.team])
        project_b = self.create_project(name="project-b", teams=[self.team])
        project_c = self.create_project(name="project-c", teams=[self.team])

        # Create an unauthorized project (attacker has no access)
        other_team = self.create_team(organization=self.organization, name="other-team")
        unauthorized_project = self.create_project(name="unauthorized-project", teams=[other_team])

        # Associate authorized projects with the release
        self.release.add_project(project_a)
        self.release.add_project(project_b)
        self.release.add_project(project_c)

        # Create a malicious artifact bundle that tries to target the unauthorized project
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug,
            release=self.release.version,
            project=unauthorized_project.slug,  # Malicious: targets unauthorized project
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)

        # Assemble with the authorized project IDs from the release
        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            project_ids=[project_a.id, project_b.id, project_c.id],
            is_release_bundle_migration=True,
        )

        # Verify the artifact bundle was created
        artifact_bundle = ArtifactBundle.objects.get(organization_id=self.organization.id)

        # CRITICAL: Verify the unauthorized project was NOT associated
        project_associations = ProjectArtifactBundle.objects.filter(
            artifact_bundle=artifact_bundle
        ).values_list("project_id", flat=True)

        assert (
            unauthorized_project.id not in project_associations
        ), "IDOR vulnerability: unauthorized project was associated with artifact bundle"

        # Verify the authorized projects ARE still associated (the fix doesn't break normal flow)
        # Since the manifest project was unauthorized, it should fall back to all authorized projects
        assert set(project_associations) == {project_a.id, project_b.id, project_c.id}

    def test_manifest_project_can_narrow_to_authorized_project(self) -> None:
        """
        Test that a manifest.json CAN specify a project if it's in the authorized list.
        This is the legitimate use case that should still work after the security fix.
        """
        from sentry.models.artifactbundle import ProjectArtifactBundle

        # Create 3 projects on the release
        project_a = self.create_project(name="project-a", teams=[self.team])
        project_b = self.create_project(name="project-b", teams=[self.team])
        project_c = self.create_project(name="project-c", teams=[self.team])

        # Associate all projects with the release
        self.release.add_project(project_a)
        self.release.add_project(project_b)
        self.release.add_project(project_c)

        # Create an artifact bundle that targets an authorized project
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug,
            release=self.release.version,
            project=project_b.slug,  # Legitimate: targets an authorized project
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), self.organization)

        # Assemble with all authorized project IDs
        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            project_ids=[project_a.id, project_b.id, project_c.id],
            is_release_bundle_migration=True,
        )

        # Verify the artifact bundle was created
        artifact_bundle = ArtifactBundle.objects.get(organization_id=self.organization.id)

        # Verify ONLY project_b is associated (narrowing worked correctly)
        project_associations = list(
            ProjectArtifactBundle.objects.filter(artifact_bundle=artifact_bundle).values_list(
                "project_id", flat=True
            )
        )

        assert project_associations == [
            project_b.id
        ], f"Expected only project_b to be associated, got {project_associations}"
