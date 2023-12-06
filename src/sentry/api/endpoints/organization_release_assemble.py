import jsonschema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.release import Release
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils import json, metrics


@region_silo_endpoint
class OrganizationReleaseAssembleEndpoint(OrganizationReleasesBaseEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def post(self, request: Request, organization, version) -> Response:
        """
        Handle an artifact bundle and merge it into the release
        ```````````````````````````````````````````````````````

        :auth: required
        """

        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        schema = {
            "type": "object",
            "properties": {
                "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                "chunks": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                },
            },
            "required": ["checksum", "chunks"],
            "additionalProperties": False,
        }

        try:
            data = json.loads(request.body)
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        checksum = data.get("checksum", None)
        chunks = data.get("chunks", [])

        upload_as_artifact_bundle = True
        is_release_bundle_migration = True
        # NOTE: this list of projects can be further refined based on the
        # `project` embedded in the bundle manifest.
        project_ids = [project.id for project in release.projects.all()]
        metrics.incr("sourcemaps.upload.release_as_artifact_bundle")

        assemble_task = (
            AssembleTask.ARTIFACT_BUNDLE
            if upload_as_artifact_bundle
            else AssembleTask.RELEASE_BUNDLE
        )

        state, detail = get_assemble_status(assemble_task, organization.id, checksum)
        if state == ChunkFileState.OK:
            return Response({"state": state, "detail": None, "missingChunks": []}, status=200)
        elif state is not None:
            return Response({"state": state, "detail": detail, "missingChunks": []})

        # There is neither a known file nor a cached state, so we will
        # have to create a new file.  Assure that there are checksums.
        # If not, we assume this is a poll and report NOT_FOUND
        if not chunks:
            return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []}, status=200)

        set_assemble_status(assemble_task, organization.id, checksum, ChunkFileState.CREATED)

        from sentry.tasks.assemble import assemble_artifacts

        assemble_artifacts.apply_async(
            kwargs={
                "org_id": organization.id,
                "version": version,
                "checksum": checksum,
                "chunks": chunks,
                # NOTE: The `dist` is embedded in the Bundle manifest and optional here.
                # It will be backfilled from the manifest within the `assemble_artifacts` task.
                "project_ids": project_ids,
                "upload_as_artifact_bundle": upload_as_artifact_bundle,
                "is_release_bundle_migration": is_release_bundle_migration,
            }
        )

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []}, status=200)
