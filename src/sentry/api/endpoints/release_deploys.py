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
from sentry.models import Deploy, Environment, Release


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateFinished = serializers.DateTimeField(required=False)


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

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        queryset = Deploy.objects.filter(
            organization_id=organization.id,
            release=release
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_finished',
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

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        serializer = DeploySerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            try:
                env = Environment.objects.get(
                    organization_id=organization.id,
                    name=result['environment']
                )
            except Environment.DoesNotExist:
                # TODO(jess) should we be creating
                # environments if they don't exist?
                raise ResourceDoesNotExist

            try:
                with transaction.atomic():
                    deploy, created = Deploy.objects.create(
                        organization_id=organization.id,
                        release=release,
                        environment_id=env.id,
                        date_finished=result.get('dateFinished', datetime.datetime.utcnow()),
                        date_started=result.get('dateStarted'),
                        name=result.get('name'),
                        url=result.get('url'),
                    ), True
            except IntegrityError:
                deploy, created = Deploy.objects.get(
                    organization_id=organization.id,
                    release=release,
                    environment_id=env.id,
                ), False
                deploy.update(
                    date_finished=result.get('dateFinished', datetime.datetime.utcnow()),
                    date_started=result.get('dateStarted'),
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
