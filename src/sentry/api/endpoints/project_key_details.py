from __future__ import absolute_import

from django.db.models import F
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, ProjectKey, ProjectKeyStatus
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.loader.browsersdkversion import (
    get_default_sdk_version_for_project,
    get_browser_sdk_version_choices
)


@scenario('DeleteClientKey')
def delete_key_scenario(runner):
    key = runner.utils.create_client_key(runner.default_project)
    runner.request(
        method='DELETE',
        path='/projects/%s/%s/keys/%s/' %
        (runner.org.slug, runner.default_project.slug, key.public_key)
    )


@scenario('UpdateClientKey')
def update_key_scenario(runner):
    key = runner.utils.create_client_key(runner.default_project)
    runner.request(
        method='PUT',
        path='/projects/%s/%s/keys/%s/' %
        (runner.org.slug, runner.default_project.slug, key.public_key),
        data={'name': 'Quite Positive Key'}
    )


class RateLimitSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=0, required=False)
    window = serializers.IntegerField(min_value=0, max_value=60 * 60 * 24, required=False)


class KeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    isActive = serializers.BooleanField(required=False)
    rateLimit = RateLimitSerializer(required=False)
    browserSdkVersion = serializers.ChoiceField(
        choices=get_browser_sdk_version_choices(), required=False
    )


class ProjectKeyDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project, key_id):
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                roles=F('roles').bitor(ProjectKey.roles.store),
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(key, request.user), status=200)

    def put(self, request, project, key_id):
        """
        Update a Client Key
        ```````````````````

        Update a client key.  This can be used to rename a key.

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :pparam string key_id: the ID of the key to update.
        :param string name: the new name for the client key.
        :auth: required
        """
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                roles=F('roles').bitor(ProjectKey.roles.store),
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = KeySerializer(data=request.DATA, partial=True)
        default_version = get_default_sdk_version_for_project(project)

        if serializer.is_valid():
            result = serializer.object

            if result.get('name'):
                key.label = result['name']

            if not result.get('browserSdkVersion'):
                key.data = {'browserSdkVersion': default_version}
            else:
                key.data = {'browserSdkVersion': result['browserSdkVersion']}

            if result.get('isActive') is True:
                key.status = ProjectKeyStatus.ACTIVE
            elif result.get('isActive') is False:
                key.status = ProjectKeyStatus.INACTIVE

            if features.has('projects:rate-limits', project):
                if result.get('rateLimit', -1) is None:
                    key.rate_limit_count = None
                    key.rate_limit_window = None
                elif result.get('rateLimit'):
                    key.rate_limit_count = result['rateLimit']['count']
                    key.rate_limit_window = result['rateLimit']['window']

            key.save()

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=key.id,
                event=AuditLogEntryEvent.PROJECTKEY_EDIT,
                data=key.get_audit_log_data(),
            )

            return Response(serialize(key, request.user), status=200)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @attach_scenarios([delete_key_scenario])
    def delete(self, request, project, key_id):
        """
        Delete a Client Key
        ```````````````````

        Delete a client key.

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :pparam string key_id: the ID of the key to delete.
        :auth: required
        """
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                roles=F('roles').bitor(ProjectKey.roles.store),
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=key.id,
            event=AuditLogEntryEvent.PROJECTKEY_REMOVE,
            data=key.get_audit_log_data(),
        )

        key.delete()

        return Response(status=204)
