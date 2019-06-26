from __future__ import absolute_import

from collections import OrderedDict
from rest_framework import serializers

from sentry.api.bases.build import BuildEndpoint
from sentry.api.serializers import serialize
from sentry.models import GitHubCheckRun, BuildStatus


BUILD_STATUSES = OrderedDict([
    ('approved', BuildStatus.APPROVED),
    ('needs_approved', BuildStatus.NEEDS_APPROVED),
])


class BuildValidator(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=zip(BUILD_STATUSES.keys(), BUILD_STATUSES.keys()),
        default='needs_approved',
    )

    def validate_status(self, attrs, source):
        value = attrs[source]
        if value:
            attrs[source] = BUILD_STATUSES[value]
        return attrs


class BuildDetailsEndpoint(BuildEndpoint):
    def get(self, request, project, build):
        """
        Retrieve a build
        ````````````````

        :pparam string build_id: the id of the build.
        :auth: required
        """
        return self.respond(serialize(build, request.user))

    def put(self, request, project, build):
        """
        Update a build
        ``````````````

        :pparam string build_id: the id of the build.
        :auth: required
        """
        validator = BuildValidator(
            data=request.DATA,
            partial=True,
            instance={
                'status': build.status,
            },
            context={
                'organization': project.organization,
                'access': request.access,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.data

        params = {}
        if 'status' in result:
            params['status'] = result['status']

        if params:
            build.update(**params)
            GitHubCheckRun.push(build)

        return self.respond(serialize(build, request.user))
