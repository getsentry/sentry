from __future__ import absolute_import

import logging
from uuid import uuid4

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    DetailedOrganizationSerializer
)
from sentry.models import (
    AuditLogEntryEvent, Organization, OrganizationOption, OrganizationStatus
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.apidocs import scenario, attach_scenarios


ERR_DEFAULT_ORG = 'You cannot remove the default organization.'

delete_logger = logging.getLogger('sentry.deletions.api')


@scenario('RetrieveOrganization')
def retrieve_organization_scenario(runner):
    runner.request(
        method='GET',
        path='/organizations/%s/' % runner.org.slug
    )


@scenario('UpdateOrganization')
def update_organization_scenario(runner):
    with runner.isolated_org('Badly Misnamed') as org:
        api_key = runner.utils.create_api_key(org)
        runner.request(
            method='PUT',
            path='/organizations/%s/' % org.slug,
            data={
                'name': 'Impeccably Designated',
                'slug': 'impeccably-designated',
            },
            api_key=api_key
        )


class OrganizationSerializer(serializers.ModelSerializer):
    projectRateLimit = serializers.IntegerField(min_value=1, max_value=100)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50,
                                  required=False)

    class Meta:
        model = Organization
        fields = ('name', 'slug')

    def validate_slug(self, attrs, source):
        value = attrs[source]
        if Organization.objects.filter(slug=value).exclude(id=self.object.id):
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
        return attrs

    def save(self):
        rv = super(OrganizationSerializer, self).save()
        # XXX(dcramer): this seems wrong, but cant find documentation on how to
        # actually access this data
        if 'projectRateLimit' in self.init_data:
            OrganizationOption.objects.set_value(
                organization=self.object,
                key='sentry:project-rate-limit',
                value=int(self.init_data['projectRateLimit']),
            )
        return rv


class OrganizationDetailsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([retrieve_organization_scenario])
    def get(self, request, organization):
        """
        Retrieve an Organization
        ````````````````````````

        Return details on an individual organization including various details
        such as membership access, features, and teams.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :auth: required
        """
        context = serialize(
            organization,
            request.user,
            DetailedOrganizationSerializer(),
        )
        return Response(context)

    @attach_scenarios([update_organization_scenario])
    def put(self, request, organization):
        """
        Update an Organization
        ``````````````````````

        Update various attributes and configurable settings for the given
        organization.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string name: an optional new name for the organization.
        :param string slug: an optional new slug for the organization.  Needs
                            to be available and unique.
        :auth: required
        """
        serializer = OrganizationSerializer(organization, data=request.DATA,
                                            partial=True)
        if serializer.is_valid():
            organization = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_EDIT,
                data=organization.get_audit_log_data(),
            )

            return Response(serialize(
                organization,
                request.user,
                DetailedOrganizationSerializer(),
            ))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, organization):
        """
        Delete an Organization
        ``````````````````````

        Schedules an organization for deletion.  This API endpoint cannot
        be invoked without a user context for security reasons.  This means
        that at present an organization can only be deleted from the
        Sentry UI.

        Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and
        will be hidden from most public views.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated():
            return Response({'detail': 'This request requires a user.'},
                            status=401)

        if organization.is_default:
            return Response({'detail': ERR_DEFAULT_ORG}, status=400)

        updated = Organization.objects.filter(
            id=organization.id,
            status=OrganizationStatus.VISIBLE,
        ).update(status=OrganizationStatus.PENDING_DELETION)
        if updated:
            transaction_id = uuid4().hex
            countdown = 86400

            entry = self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_REMOVE,
                data=organization.get_audit_log_data(),
                transaction_id=transaction_id,
            )

            organization.send_delete_confirmation(entry, countdown)

            delete_organization.apply_async(
                kwargs={
                    'object_id': organization.id,
                    'transaction_id': transaction_id,
                },
                countdown=countdown,
            )

            delete_logger.info('object.delete.queued', extra={
                'object_id': organization.id,
                'transaction_id': transaction_id,
                'model': Organization.__name__,
            })

        return Response(status=204)
