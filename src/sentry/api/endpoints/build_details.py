from __future__ import absolute_import

from sentry.api.bases.build import BuildEndpoint
from sentry.api.serializers import serialize


class BuildDetailsEndpoint(BuildEndpoint):
    def get(self, request, project, build):
        """
        Retrieve a build
        ````````````````

        :pparam string build_id: the id of the build.
        :auth: required
        """
        return self.respond(serialize(build, request.user))
