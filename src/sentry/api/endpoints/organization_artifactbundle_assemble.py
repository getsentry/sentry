import jsonschema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, options
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import get_auth_api_token_type
from sentry.constants import ObjectStatus
from sentry.models import FileBlobOwner, Project
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils import json


class OrganizationArtifactBundleAssembleMixin:
    @classmethod
    def find_missing_chunks(cls, organization, chunks):
        """
        Returns a list of chunks which are missing for an org.
        """
        owned = set(
            FileBlobOwner.objects.filter(
                blob__checksum__in=chunks, organization_id=organization.id
            ).values_list("blob__checksum", flat=True)
        )

        return list(set(chunks) - owned)


@region_silo_endpoint
class OrganizationArtifactBundleAssembleEndpoint(
    OrganizationReleasesBaseEndpoint, OrganizationArtifactBundleAssembleMixin
):
    def post(self, request: Request, organization) -> Response:
        """
        Assembles an artifact bundle and stores the debug ids in the database.
        """
        schema = {
            "type": "object",
            "properties": {
                # The version pattern has been extracted from the url definition of OrganizationReleaseAssembleEndpoint.
                "version": {"type": "string", "pattern": "^[^/]+$"},
                "dist": {"type": "string"},
                "projects": {"type": "array", "items": {"type": "string"}},
                "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                "chunks": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                },
            },
            "required": ["checksum", "chunks", "projects"],
            "additionalProperties": False,
        }

        try:
            data = json.loads(request.body)
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        projects = set(data.get("projects", []))
        if len(projects) == 0:
            return Response({"error": "You need to specify at least one project"}, status=400)

        project_ids = Project.objects.filter(
            organization=organization, status=ObjectStatus.ACTIVE, slug__in=projects
        ).values_list("id", flat=True)
        if len(project_ids) != len(projects):
            return Response({"error": "One or more projects are invalid"}, status=400)

        if not self.has_release_permission(request, organization, project_ids=set(project_ids)):
            raise ResourceDoesNotExist

        checksum = data.get("checksum")
        chunks = data.get("chunks", [])

        # We want to put the missing chunks functionality behind an option in order to cut it off in case of CLI
        # regressions for our users.
        if options.get("sourcemaps.artifact_bundles.assemble_with_missing_chunks") is True:
            # We check if all requested chunks have been uploaded.
            missing_chunks = self.find_missing_chunks(organization, chunks)
            # In case there are some missing chunks, we will tell the client which chunks we require.
            if missing_chunks:
                return Response(
                    {
                        "state": ChunkFileState.NOT_FOUND,
                        "missingChunks": missing_chunks,
                    }
                )

        # We want to check the current state of the assemble status.
        state, detail = get_assemble_status(AssembleTask.ARTIFACT_BUNDLE, organization.id, checksum)
        if state == ChunkFileState.OK:
            return Response({"state": state, "detail": None, "missingChunks": []}, status=200)
        elif state is not None:
            # In case we have some state into the cache, we will not perform any assembly task again and rather we will
            # return. This might cause issues with CLI because it might have uploaded the same bundle chunks two times
            # in a row but only the first call the assemble started the assembly task, all subsequent calls will get
            # an assemble status.
            return Response({"state": state, "detail": detail, "missingChunks": []})

        # There is neither a known file nor a cached state, so we will
        # have to create a new file.  Assure that there are checksums.
        # If not, we assume this is a poll and report NOT_FOUND
        if not chunks:
            return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []}, status=200)

        set_assemble_status(
            AssembleTask.ARTIFACT_BUNDLE, organization.id, checksum, ChunkFileState.CREATED
        )

        from sentry.tasks.assemble import assemble_artifacts

        version = data.get("version")
        dist = data.get("dist")

        if not version and dist:
            return Response(
                {"error": "You need to specify a release together with a dist"}, status=400
            )

        assemble_artifacts.apply_async(
            kwargs={
                "org_id": organization.id,
                "project_ids": list(project_ids),
                # We don't perform any validation of the version, since the user might bind a bundle to a specific
                # release version without actually having created the release object itself.
                "version": version,
                "dist": dist,
                "checksum": checksum,
                "chunks": chunks,
                "upload_as_artifact_bundle": True,
            }
        )

        analytics.record(
            "artifactbundle.assemble",
            user_id=request.user.id if request.user and request.user.id else None,
            organization_id=organization.id,
            project_ids=project_ids,
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            auth_type=get_auth_api_token_type(request.auth),
        )

        if is_org_auth_token_auth(request.auth):
            update_org_auth_token_last_used(request.auth, project_ids)

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []}, status=200)
