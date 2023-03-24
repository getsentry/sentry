from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.constants import DS_DENYLIST, PROTECTED_TAG_KEYS
from sentry.models import Environment


@region_silo_endpoint
class ProjectTagsEndpoint(ProjectEndpoint, EnvironmentMixin):
    def get(self, request: Request, project) -> Response:
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            tag_keys = []
        else:
            kwargs = dict(
                # We might be able to stop including these values, but this
                # is a pretty old endpoint, so concerned about breaking
                # existing api consumers.
                include_values_seen=True,
            )
            if request.GET.get("onlySamplingTags") == "1":
                kwargs.update(denylist=DS_DENYLIST)

            tag_keys = sorted(
                tagstore.get_tag_keys(
                    project.id,
                    environment_id,
                    tenant_ids={"organization_id": project.organization_id},
                    **kwargs,
                ),
                key=lambda x: x.key,
            )

        data = []
        for tag_key in tag_keys:
            data.append(
                {
                    "key": tagstore.get_standardized_key(tag_key.key),
                    "name": tagstore.get_tag_key_label(tag_key.key),
                    "uniqueValues": tag_key.values_seen,
                    "canDelete": tag_key.key not in PROTECTED_TAG_KEYS,
                }
            )

        return Response(data)
