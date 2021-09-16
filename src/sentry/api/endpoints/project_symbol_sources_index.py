"""API to handle symbol sources.

The symbol sources are stored in a project option as JSON array of objects and can be
directly manipulated via the project details.  This API aims to provide an easier API to
handle changing symbol sources however.

Provides the following endpoints:

1. ``GET /{org_slug}/{proj_slug}/symbolsources/`` to retrieve all symbol sources as a JSON
   array of config objects.

2. ``POST /{org_slug}/{proj_slug}/symbolsources/`` to create a single new config object.

The companion API in project_symbol_sources_details.py provides:

3. ``PUT /{org_slug}/{proj_slug}/symbolsources/{id}`` to update an existing config object.

4. ``DELETE /{org_slug}/{proj_slug}/symbolsources/{id}`` to delete an existing config object.
"""

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.lang.native import symbolicator
from sentry.models import Project
from sentry.utils import json


class ProjectSymbolSourcesIndexEndpoint(ProjectEndpoint):  # type: ignore
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
        if not features.has("organizations:symbol-sources", project.organization):
            return Response(status=404)
        configs_unredacted = project.get_option("sentry:symbol_sources", "[]")
        try:
            configs_str = symbolicator.redact_source_secrets(configs_unredacted)
            configs_json = json.loads(configs_str)
        except Exception:
            sentry_sdk.capture_exception()
            configs_json = []
        return Response(configs_json, status=200)

    def post(self, request: Request, project: Project) -> Response:
        pass
