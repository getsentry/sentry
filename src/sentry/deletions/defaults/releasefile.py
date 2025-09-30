from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.releasefile import ReleaseFile


class ReleaseFileDeletionTask(ModelDeletionTask[ReleaseFile]):
    def get_child_relations(self, instance: ReleaseFile) -> list[BaseRelation]:
        from sentry.models.files.file import File

        # Always safe to delete Files for these types as they are 1:1 with ReleaseFile
        always_safe_types = {
            "release.file",  # Regular uploaded files
            "release.artifact-index",  # Artifact index files (release-specific)
        }

        if instance.file.type in always_safe_types:
            return [
                ModelRelation(File, {"id": instance.file_id}),
            ]

        # For artifact.bundle files, only delete if no other references exist
        if instance.file.type == "artifact.bundle":
            if self._is_last_reference_to_file(instance):
                return [
                    ModelRelation(File, {"id": instance.file_id}),
                ]

        # For other unknown types, don't delete the File to be safe
        return []

    def _is_last_reference_to_file(self, instance: ReleaseFile) -> bool:
        """Check if this ReleaseFile is the last reference to the File."""
        from sentry.models.artifactbundle import ArtifactBundle

        # Count other ReleaseFile records pointing to the same file (excluding this one)
        other_releasefiles = (
            ReleaseFile.objects.filter(file_id=instance.file_id).exclude(id=instance.id).count()
        )

        # Count ArtifactBundle records pointing to the same file
        artifact_bundles = ArtifactBundle.objects.filter(file_id=instance.file_id).count()

        # Only safe to delete if no other references exist
        return other_releasefiles == 0 and artifact_bundles == 0
