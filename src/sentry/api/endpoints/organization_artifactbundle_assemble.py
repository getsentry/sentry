from typing import int
import jsonschema
import orjson
import sentry_sdk
from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.debug_files.upload import find_missing_chunks
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.models.project import Project
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)


@region_silo_endpoint
class OrganizationArtifactBundleAssembleEndpoint(OrganizationReleasesBaseEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization) -> Response:
        """
        Assembles an artifact bundle and stores the debug ids in the database.
        """
        with sentry_sdk.start_span(op="artifact_bundle.assemble"):
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

            error_messages = {
                "version": 'The version field cannot be empty and cannot contain any "/" characters.',
                "dist": "The dist field must be a string.",
                "projects": "The projects field is required and must be provided as an array of strings.",
                "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
                "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
            }

            try:
                data = orjson.loads(request.body)
                jsonschema.validate(data, schema)
            except jsonschema.ValidationError as e:
                error_message = e.message
                # Get the field from the path if available
                if e.path:
                    if field := e.path[0]:
                        error_message = error_messages.get(str(field), error_message)

                return Response({"error": error_message}, status=400)
            except Exception:
                return Response({"error": "Invalid json body"}, status=400)

            input_projects = data.get("projects", [])
            if len(input_projects) == 0:
                return Response({"error": "You need to specify at least one project"}, status=400)

            input_project_slug = set()
            input_project_id = set()
            for project in input_projects:
                # IDs are always numeric, slugs cannot be numeric
                if str(project).isdecimal():
                    input_project_id.add(project)
                else:
                    input_project_slug.add(project)

            with sentry_sdk.start_span(op="artifact_bundle.assemble.find_projects"):
                project_ids = Project.objects.filter(
                    (Q(id__in=input_project_id) | Q(slug__in=input_project_slug)),
                    organization=organization,
                    status=ObjectStatus.ACTIVE,
                ).values_list("id", flat=True)

            if len(project_ids) != len(input_projects):
                return Response({"error": "One or more projects are invalid"}, status=400)

            with sentry_sdk.start_span(op="artifact_bundle.assemble.check_release_permission"):
                if not self.has_release_permission(
                    request, organization, project_ids=set(project_ids)
                ):
                    raise ResourceDoesNotExist

            checksum = data.get("checksum")
            chunks = data.get("chunks", [])

            # We check if all requested chunks have been uploaded.
            missing_chunks = find_missing_chunks(organization.id, set(chunks))

            # In case there are some missing chunks, we will tell the client which chunks we require.
            if missing_chunks:
                return Response(
                    {
                        "state": ChunkFileState.NOT_FOUND,
                        "missingChunks": missing_chunks,
                    }
                )

            # We want to check the current state of the assemble status.
            state, detail = get_assemble_status(
                AssembleTask.ARTIFACT_BUNDLE, organization.id, checksum
            )
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
                return Response(
                    {"state": ChunkFileState.NOT_FOUND, "missingChunks": []}, status=200
                )

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

            with sentry_sdk.start_span(op="artifact_bundle.assemble.start_assemble_artifacts"):
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
                    }
                )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, list(project_ids))

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []}, status=200)
