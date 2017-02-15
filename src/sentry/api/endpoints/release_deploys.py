from __future__ import absolute_import

import datetime

from django.db import IntegrityError, transaction

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.models import Deploy, DeployResource, Environment, Release


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateFinished = serializers.DateTimeField(required=False)
    resources = ListField(required=False)


class ReleaseDeploysEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, organization, version):
        """
        List a Release's Deploys
        ````````````````````````
        Return a list of deploys for a given release.
        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.

        """
        try:
            release = Release.objects.get(
                version=version,
                organization=organization
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        allowed_projects = set(
            self.get_allowed_projects(
                request,
                organization
            ).values_list('id', flat=True)
        )

        # make sure user has access to at least one project
        # in release
        if not [p for p in release.projects.values_list('id', flat=True) if p in allowed_projects]:
            raise PermissionDenied

        queryset = Deploy.objects.filter(
            organization_id=organization.id,
            release=release
        ).extra(select={
            'sort': 'COALESCE(date_finished, date_started)',
        })

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-sort',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, organization, version):
        """
        List a Release's Deploys
        ````````````````````````
        Return a list of deploys for a given release.
        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.

        """
        try:
            release = Release.objects.get(
                version=version,
                organization=organization
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        allowed_projects = set(
            self.get_allowed_projects(
                request,
                organization
            ).values_list('id', flat=True)
        )

        allowed_projects_in_release = {
            p for p in release.projects.values_list('id', flat=True) if p in allowed_projects
        }

        # make sure user has access to at least one project
        # in release
        if not allowed_projects_in_release:
            raise PermissionDenied

        serializer = DeploySerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            # TODO(jess) umm should environment be unique across org?
            # also should we be creating environments if they don't exist?
            env_ids = Environment.objects.filter(
                project_id__in=allowed_projects_in_release,
                name=result['environment']
            ).values_list('id', flat=True)

            if not env_ids:
                raise ResourceDoesNotExist

            created = False
            for env_id in env_ids:
                try:
                    with transaction.atomic():
                        deploy, created = Deploy.objects.create(
                            organization_id=organization.id,
                            release=release,
                            environment_id=env_id,
                            date_finished=result.get('dateFinished', datetime.datetime.utcnow()),
                            date_started=result.get('dateStarted'),
                            name=result.get('name'),
                            url=result.get('url'),
                        ), True
                except IntegrityError:
                    deploy = Deploy.objects.get(
                        organization_id=organization.id,
                        release=release,
                        environment_id=env_id,
                    )
                else:
                    for resource in result.get('resources', []):
                        try:
                            with transaction.atomic():
                                deploy.resources.create(
                                    organization_id=organization.id,
                                    name=resource
                                )
                        except IntegrityError:
                            deploy.add(
                                DeployResource.objects.get(
                                    organization_id=organization.id,
                                    name=resource
                                )
                            )

            # This is the closest status code that makes sense, and we want
            # a unique 2xx response code so people can understand when
            # behavior differs.
            #   208 Already Reported (WebDAV; RFC 5842)
            status = 201 if created else 208

            # TODO(jess) this is sort of weird because there
            # could have been multiple deploys created...
            return Response(serialize(deploy, request.user), status=status)

        return Response(serializer.errors, status=400)
