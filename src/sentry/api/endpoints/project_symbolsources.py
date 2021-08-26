"""API to handle symbol sources.

The symbol sources are stored in a project option as JSON array of objects and can be
directly manipulated via the project details.  This API aims to provide an easier API to
handle changing symbol sources however.

Provides the following endpoints:

1. ``GET /{org_slug}/{proj_slug}/symbolsources/`` to retrieve all symbol sources as a JSON
   array of config objects.

2. ``POST /{org_slug}/{proj_slug}/symbolsources/`` to create a single new config object.


3. ``PUT /{org_slug}/{proj_slug}/symbolsources/{id}`` to update an existing config object.

4. ``DELETE /{org_slug}/{proj_slug}/symbolsources/{id}`` to delete an existing config object.
"""

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.models import Project


class ProjectSymbolSourcesEndpoint(ProjectEndpoint):  # type: ignore
    """Manages all the symbol sources for a project.

    1. ``GET /{org_slug}/{proj_slug}/symbolsources/`` retrieves an array of the config
       objects for all symbol sources.  Secrets will not be returned and instead be replaced
       with the object ``{_hidden-secret: true}``.

    2. ``POST /{org_slug}/{proj_slug}/symbolsources/`` creates a new config object with the
       provided JSON body, if the config object validates.

    The config objects depend on the type of the symbol source, but each one will have an
    ``id``, ``type`` and ``name`` field.  See :attr:`sentry.lang.native.SOURCES_SCHEMA` for
    the full schema for each.
    """

    permission_classes = [StrictProjectPermission]

    def get(self, request: Request, project: Project) -> Response:
        pass

    def post(self, request: Request, project: Project) -> Response:
        pass


class ProjectSymbolSourcesConfigEndpoint(ProjectEndpoint):  # type: ignore
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
