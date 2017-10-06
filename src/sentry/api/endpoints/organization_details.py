from __future__ import absolute_import

import logging

from rest_framework import serializers, status
from rest_framework.response import Response
from uuid import uuid4

from sentry import roles
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.fields import AvatarField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (DetailedOrganizationSerializer)
from sentry.api.serializers.rest_framework import ListField
from sentry.models import (
    AuditLogEntryEvent, Organization, OrganizationAvatar, OrganizationOption, OrganizationStatus
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_DEFAULT_ORG = 'You cannot remove the default organization.'

ORG_OPTIONS = (
    # serializer field name, option key name, type
    ('projectRateLimit', 'sentry:project-rate-limit', int),
    ('accountRateLimit', 'sentry:account-rate-limit', int),
    ('dataScrubber', 'sentry:require_scrub_data', bool),
    ('dataScrubberDefaults', 'sentry:require_scrub_defaults', bool),
    ('sensitiveFields', 'sentry:sensitive_fields', list),
    ('safeFields', 'sentry:safe_fields', list),
    ('scrubIPAddresses', 'sentry:require_scrub_ip_address', bool),
)

delete_logger = logging.getLogger('sentry.deletions.api')


@scenario('RetrieveOrganization')
def retrieve_organization_scenario(runner):
    runner.request(method='GET', path='/organizations/%s/' % runner.org.slug)


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


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50)
    accountRateLimit = serializers.IntegerField(min_value=0, max_value=1000000, required=False)
    projectRateLimit = serializers.IntegerField(min_value=50, max_value=100, required=False)
    avatar = AvatarField(required=False)
    avatarType = serializers.ChoiceField(
        choices=(('upload', 'upload'), ('letter_avatar', 'letter_avatar'), ), required=False
    )

    openMembership = serializers.BooleanField(required=False)
    allowSharedIssues = serializers.BooleanField(required=False)
    enhancedPrivacy = serializers.BooleanField(required=False)
    dataScrubber = serializers.BooleanField(required=False)
    dataScrubberDefaults = serializers.BooleanField(required=False)
    sensitiveFields = ListField(child=serializers.CharField(), required=False)
    safeFields = ListField(child=serializers.CharField(), required=False)
    scrubIPAddresses = serializers.BooleanField(required=False)
    isEarlyAdopter = serializers.BooleanField(required=False)

    def validate_slug(self, attrs, source):
        value = attrs[source]
        if Organization.objects.filter(slug=value).exclude(id=self.context['organization'].id):
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value, ))
        return attrs

    def validate_sensitiveFields(self, attrs, source):
        value = attrs[source]
        if value and not all(value):
            raise serializers.ValidationError('Empty values are not allowed.')
        return attrs

    def validate_safeFields(self, attrs, source):
        value = attrs[source]
        if value and not all(value):
            raise serializers.ValidationError('Empty values are not allowed.')
        return attrs

    def validate(self, attrs):
        attrs = super(OrganizationSerializer, self).validate(attrs)
        if attrs.get('avatarType') == 'upload':
            has_existing_file = OrganizationAvatar.objects.filter(
                organization=self.context['organization'],
                file__isnull=False,
            ).exists()
            if not has_existing_file and not attrs.get('avatar'):
                raise serializers.ValidationError(
                    {
                        'avatarType': 'Cannot set avatarType to upload without avatar',
                    }
                )
        return attrs

    def save(self):
        org = self.context['organization']
        if 'openMembership' in self.init_data:
            org.flags.allow_joinleave = self.init_data['openMembership']
        if 'allowSharedIssues' in self.init_data:
            org.flags.disable_shared_issues = not self.init_data['allowSharedIssues']
        if 'enhancedPrivacy' in self.init_data:
            org.flags.enhanced_privacy = self.init_data['enhancedPrivacy']
        if 'isEarlyAdopter' in self.init_data:
            org.flags.early_adopter = self.init_data['isEarlyAdopter']
        if 'name' in self.init_data:
            org.name = self.init_data['name']
        if 'slug' in self.init_data:
            org.slug = self.init_data['slug']
        org.save()
        for key, option, type_ in ORG_OPTIONS:
            if key in self.init_data:
                OrganizationOption.objects.set_value(
                    organization=org,
                    key=option,
                    value=type_(self.init_data[key]),
                )
        if 'avatar' in self.init_data or 'avatarType' in self.init_data:
            OrganizationAvatar.save_avatar(
                relation={'organization': org},
                type=self.init_data.get('avatarType', 'upload'),
                avatar=self.init_data.get('avatar'),
                filename='{}.png'.format(org.slug),
            )
        return org


class OwnerOrganizationSerializer(OrganizationSerializer):
    defaultRole = serializers.ChoiceField(choices=roles.get_choices())

    def save(self, *args, **kwargs):
        org = self.context['organization']
        if 'defaultRole' in self.init_data:
            org.default_role = self.init_data['defaultRole']
        return super(OwnerOrganizationSerializer, self).save(*args, **kwargs)


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
        if request.access.has_scope('org:admin'):
            serializer_cls = OwnerOrganizationSerializer
        else:
            serializer_cls = OrganizationSerializer
        serializer = serializer_cls(
            data=request.DATA,
            partial=True,
            context={'organization': organization},
        )
        if serializer.is_valid():
            organization = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_EDIT,
                data=organization.get_audit_log_data(),
            )

            return Response(
                serialize(
                    organization,
                    request.user,
                    DetailedOrganizationSerializer(),
                )
            )

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
            return Response({'detail': 'This request requires a user.'}, status=401)

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
                    'actor_id': request.user.id,
                },
                countdown=countdown,
            )

            delete_logger.info(
                'object.delete.queued',
                extra={
                    'object_id': organization.id,
                    'transaction_id': transaction_id,
                    'model': Organization.__name__,
                }
            )

        return Response(status=204)
