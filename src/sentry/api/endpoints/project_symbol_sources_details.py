"""API to modify individual symbol sources.

The symbol sources are stored in a project option as JSON array of objects and can be
directly manipulated via the project details.  This API aims to provide an easier API to
handle changing symbol sources however.

Provides the following endpoints:

- ``PUT /{org_slug}/{proj_slug}/symbolsources/{id}`` to update an existing config object.

- ``DELETE /{org_slug}/{proj_slug}/symbolsources/{id}`` to delete an existing config object.

The companion API in project_symbol_sources_index.py provides the collection APIs:

- ``GET /{org_slug}/{proj_slug}/symbolsources/`` to retrieve all symbol sources as a JSON
  array of config objects.

- ``POST /{org_slug}/{proj_slug}/symbolsources/`` to create a single new config object.
"""

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.models import Project


class ProjectSymbolSourcesDetailsEndpoint(ProjectEndpoint):  # type: ignore
    """Manages a single symbol source for a project.

    1. ``PUT /{org_slug}/{proj_slug}/symbolsources/{id}`` returns the configuration object
       for the symbol source with the given ID.  Secrets will not be returned and instead be
       replaced with the object ``{_hidden-secret: true}``.

    2. ``PUT /{org_slug}/{proj_slug}/symbolsources/{id}`` updates a symbol source's config.
       The body must be the new JSON config object matching the JSON schema with one
       exception: the value of any secret can be replaced with the object ``{_hidden-secret:
       true}`` in which case the secret will not be modified from the previous value.

    3. ``DELETE /{org_slug}/{proj_slug}/symbolsources/{id}`` deletes an existing config
       object.
    """

    permission_classes = [StrictProjectPermission]

    def get(self, request: Request, project: Project, cfg_id: str) -> Response:
        pass

    def put(self, request: Request, project: Project, cfg_id: str) -> Response:
        pass

    def delete(self, request: Request, project: Project, cfg_id: str) -> Response:
        pass
