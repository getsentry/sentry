from django.db import router
from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ArtifactBundle, ProjectArtifactBundle
from sentry.utils.db import atomic_transaction


@region_silo_endpoint
class ArtifactBundlesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Artifact Bundles
        ````````````````````````````````````

        Retrieve a list of artifact bundles for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          artifact bundle belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     artifact bundles of.
        """
        query = request.GET.get("query")

        try:
            queryset = ProjectArtifactBundle.objects.filter(
                organization_id=project.organization_id, project_id=project.id
            ).select_related("artifact_bundle")
        except ProjectArtifactBundle.DoesNotExist:
            raise ResourceDoesNotExist

        if query:
            query_q = Q(artifact_bundle__bundle_id__icontains=query)
            queryset = queryset.filter(query_q)

        def expose_artifact_bundle(debug_id_artifact_bundle):
            artifact_bundle = debug_id_artifact_bundle.artifact_bundle

            return {
                "type": "artifact_bundle",
                "name": str(artifact_bundle.bundle_id),
                "date": debug_id_artifact_bundle.date_added.isoformat()[:19] + "Z",
                "fileCount": artifact_bundle.artifact_count,
            }

        def serialize_results(results):
            # We want to maintain the -date_added ordering, thus we index the metadata by using the id fetched with the
            # first query.
            return serialize(
                [expose_artifact_bundle(debug_id_artifact_bundle=r) for r in results],
                request.user,
            )

        sort_by = request.GET.get("sortBy", "-date_added")
        if sort_by not in {"-date_added", "date_added"}:
            return Response(
                {"error": "You can either sort via 'date_added' or '-date_added'"}, status=400
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=sort_by,
            paginator_cls=OffsetPaginator,
            default_per_page=10,
            on_results=serialize_results,
        )

    def delete(self, request: Request, project) -> Response:
        """
        Delete an Archive
        ```````````````````````````````````````````````````

        Delete all artifacts inside given archive.

        :pparam string organization_slug: the slug of the organization the
                                            archive belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                        archive of.
        :qparam string name: The name of the archive to delete.
        :auth: required
        """

        bundle_id = request.GET.get("bundleId")

        if bundle_id:
            try:
                artifact_bundle = ArtifactBundle.objects.get(
                    organization_id=project.organization_id, bundle_id=bundle_id
                )
            except ArtifactBundle.DoesNotExist:
                return Response(
                    {"error": f"Couldn't find a bundle with bundle_id {bundle_id}"}, status=404
                )

            with atomic_transaction(using=router.db_for_write(ArtifactBundle)):
                # We want to delete all the connections to a project.
                ProjectArtifactBundle.objects.filter(artifact_bundle_id=artifact_bundle.id).delete()

                # We also delete the bundle itself.
                artifact_bundle.delete()

                return Response(status=204)

        return Response({"error": f"Supplied an invalid bundle_id {bundle_id}"}, status=404)
