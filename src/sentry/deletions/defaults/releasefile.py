from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.releasefile import ReleaseFile


class ReleaseFileDeletionTask(ModelDeletionTask[ReleaseFile]):
    def get_child_relations(self, instance: ReleaseFile) -> list[BaseRelation]:
        from sentry.models.files.file import File

        try:
            file_type = instance.file.type
        except File.DoesNotExist:
            return []

        # Only delete Files for these types as they are 1:1 with ReleaseFile
        safe_to_delete_types = {
            "release.file",  # Regular uploaded files
            "release.artifact-index",  # Artifact index files (release-specific)
        }

        if file_type in safe_to_delete_types:
            return [
                ModelRelation(File, {"id": instance.file_id}),
            ]

        # For other types, don't delete the File to be safe
        return []
