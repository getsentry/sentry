from __future__ import absolute_import

import logging
import six

from rest_framework import serializers, status
from uuid import uuid4

from sentry import roles
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.fields import AvatarField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    DetailedOrganizationSerializer)
from sentry.api.serializers.rest_framework import ListField
from sentry.constants import RESERVED_ORGANIZATION_SLUGS
from sentry.models import (
    AuditLogEntryEvent, Authenticator, Organization, OrganizationAvatar, OrganizationOption, OrganizationStatus
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_DEFAULT_ORG = 'You cannot remove the default organization.'

ERR_NO_USER = 'This request requires an authenticated user.'

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

DELETION_STATUSES = frozenset([OrganizationStatus.PENDING_DELETION,
                               OrganizationStatus.DELETION_IN_PROGRESS])


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
    accountRateLimit = serializers.IntegerField(
        min_value=0, max_value=1000000, required=False)
    projectRateLimit = serializers.IntegerField(
        min_value=50, max_value=100, required=False)
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
    require2FA = serializers.BooleanField(required=False)

    def validate_slug(self, attrs, source):
        value = attrs[source]
        # Historically, the only check just made sure there was more than 1
        # character for the slug, but since then, there are many slugs that
        # fit within this new imposed limit. We're not fixing existing, but
        # just preventing new bad values.
        if len(value) < 3:
            raise serializers.ValidationError(
                'This slug "%s" is too short. Minimum of 3 characters.' %
                (value, ))
        if value in RESERVED_ORGANIZATION_SLUGS:
            raise serializers.ValidationError(
                'This slug "%s" is reserved and not allowed.' %
                (value, ))
        qs = Organization.objects.filter(
            slug=value,
        ).exclude(id=self.context['organization'].id)
        if qs.exists():
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

    def validate_require2FA(self, attrs, source):
        value = attrs[source]
        user = self.context['user']
        has_2fa = Authenticator.objects.user_has_2fa(user)
        if value and not has_2fa:
            raise serializers.ValidationError(
                'User setting two-factor authentication enforcement without two-factor authentication enabled.')
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
        changed_data = {}

        for key, option, type_ in ORG_OPTIONS:
            if key not in self.init_data:
                continue
            try:
                option_inst = OrganizationOption.objects.get(
                    organization=org, key=option)
            except OrganizationOption.DoesNotExist:
                OrganizationOption.objects.set_value(
                    organization=org,
                    key=option,
                    value=type_(self.init_data[key]),
                )
                # TODO(kelly): This will not work if new ORG_OPTIONS are added and their
                # default value evaluates as truthy, but this should work for now with the
                # current ORG_OPTIONS (assumes ORG_OPTIONS are falsy)
                if type_(self.init_data[key]):
                    changed_data[key] = self.init_data[key]
            else:
                option_inst.value = self.init_data[key]
                # check if ORG_OPTIONS changed
                if option_inst.has_changed('value'):
                    old_val = option_inst.old_value('value')
                    changed_data[key] = u'from {} to {}'.format(old_val, option_inst.value)
                option_inst.save()

        if 'openMembership' in self.init_data:
            org.flags.allow_joinleave = self.init_data['openMembership']
        if 'allowSharedIssues' in self.init_data:
            org.flags.disable_shared_issues = not self.init_data['allowSharedIssues']
        if 'enhancedPrivacy' in self.init_data:
            org.flags.enhanced_privacy = self.init_data['enhancedPrivacy']
        if 'isEarlyAdopter' in self.init_data:
            org.flags.early_adopter = self.init_data['isEarlyAdopter']
        if 'require2FA' in self.init_data:
            org.flags.require_2fa = self.init_data['require2FA']
        if 'name' in self.init_data:
            org.name = self.init_data['name']
        if 'slug' in self.init_data:
            org.slug = self.init_data['slug']

        org_tracked_field = {
            'name': org.name,
            'slug': org.slug,
            'default_role': org.default_role,
            'flag_field': {
                'allow_joinleave': org.flags.allow_joinleave.is_set,
                'enhanced_privacy': org.flags.enhanced_privacy.is_set,
                'disable_shared_issues': org.flags.disable_shared_issues.is_set,
                'early_adopter': org.flags.early_adopter.is_set,
                'require_2fa': org.flags.require_2fa.is_set,
            }
        }

        # check if fields changed
        for f, v in six.iteritems(org_tracked_field):
            if f is not 'flag_field':
                if org.has_changed(f):
                    old_val = org.old_value(f)
                    changed_data[f] = u'from {} to {}'.format(old_val, v)
            else:
                # check if flag fields changed
                for f, v in six.iteritems(org_tracked_field['flag_field']):
                    if org.flag_has_changed(f):
                        changed_data[f] = u'to {}'.format(v)

        org.save()

        if 'avatar' in self.init_data or 'avatarType' in self.init_data:
            OrganizationAvatar.save_avatar(
                relation={'organization': org},
                type=self.init_data.get('avatarType', 'upload'),
                avatar=self.init_data.get('avatar'),
                filename='{}.png'.format(org.slug),
            )
        if 'require2FA' in self.init_data and self.init_data['require2FA'] is True:
            org.send_setup_2fa_emails()
        return org, changed_data


class OwnerOrganizationSerializer(OrganizationSerializer):
    defaultRole = serializers.ChoiceField(choices=roles.get_choices())
    cancelDeletion = serializers.BooleanField(required=False)

    def save(self, *args, **kwargs):
        org = self.context['organization']
        cancel_deletion = 'cancelDeletion' in self.init_data and org.status in DELETION_STATUSES
        if 'defaultRole' in self.init_data:
            org.default_role = self.init_data['defaultRole']
        if cancel_deletion:
            org.status = OrganizationStatus.VISIBLE
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
        return self.respond(context)

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

        was_pending_deletion = organization.status in DELETION_STATUSES

        serializer = serializer_cls(
            data=request.DATA,
            partial=True,
            context={'organization': organization, 'user': request.user},
        )
        if serializer.is_valid():
            organization, changed_data = serializer.save()

            if was_pending_deletion:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=AuditLogEntryEvent.ORG_RESTORE,
                    data=organization.get_audit_log_data(),
                )
                delete_logger.info(
                    'object.delete.canceled',
                    extra={
                        'object_id': organization.id,
                        'model': Organization.__name__,
                    }
                )
            else:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=AuditLogEntryEvent.ORG_EDIT,
                    data=changed_data
                )

            return self.respond(
                serialize(
                    organization,
                    request.user,
                    DetailedOrganizationSerializer(),
                )
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
            return self.respond({'detail': ERR_NO_USER}, status=401)

        if organization.is_default:
            return self.respond({'detail': ERR_DEFAULT_ORG}, status=400)

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

        context = serialize(
            organization,
            request.user,
            DetailedOrganizationSerializer(),
        )
        return self.respond(context, status=202)
