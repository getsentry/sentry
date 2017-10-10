from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.db.models import F
from django.http import HttpResponse
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.auth import manager
from sentry.auth.helper import AuthHelper
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationAuthProvidersPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, AuthProvider, OrganizationMember
from sentry.plugins.base.response import Response as PluginResponse
from sentry.utils import db
from sentry.utils.http import absolute_uri

ERR_NO_SSO = _('The SSO feature is not enabled for this organization.')

OK_PROVIDER_DISABLED = _('SSO authentication has been disabled.')


class AuthSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthProvider
        fields = ('id', 'organization')


class OrganizationAuthProviderEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProvidersPermission, )

    def get(self, request, organization):
        """
        Retrieve an Organization's Auth Provider
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        if not features.has('organizations:sso', organization, actor=request.user):
            return Response(ERR_NO_SSO, status=status.HTTP_403_FORBIDDEN)

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization,
            )
        except AuthProvider.DoesNotExist:
            # This is a valid state where org does not have an auth provider
            # configured, make sure we respond with a 200
            return Response(None, status=status.HTTP_200_OK)
        else:
            # provider configure view can either be a template or a http response
            provider = auth_provider.get_provider()

            view = provider.get_configure_view()
            response = view(request, organization, auth_provider)

            if isinstance(response, HttpResponse):
                return response
            elif isinstance(response, PluginResponse):
                response = response.render(
                    request, {
                        'auth_provider': auth_provider,
                        'organization': organization,
                        'provider': provider,
                    }
                )

            pending_links_count = OrganizationMember.objects.filter(
                organization=organization,
                flags=~getattr(OrganizationMember.flags, 'sso:linked'),
            ).count()

            context = {
                'pending_links_count': pending_links_count,
                'login_url': absolute_uri(reverse('sentry-organization-home', args=[organization.slug])),
                'auth_provider': serialize(auth_provider),
                'default_role': organization.default_role,
                'require_link': not auth_provider.flags.allow_unlinked,
                'provider_name': provider.name,
                'content': serialize(response),
            }

            return Response(serialize(context, request.user))

    def post(self, request, organization):
        """
        Start Auth Provider flow
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :param string provider: the auth provider name
        :param boolean init: specifies if we should start pipeline
        :auth: required
        """
        if not features.has('organizations:sso', organization, actor=request.user):
            return Response(ERR_NO_SSO, status=status.HTTP_403_FORBIDDEN)

        provider_key = request.DATA.get('provider')
        init = request.DATA.get('init')

        if not manager.exists(provider_key):
            return Response({'message': 'Provider not found: {}'.format(
                provider_key)}, status=status.HTTP_404_NOT_FOUND)

        # Return auth url or template
        helper = AuthHelper(
            request=request,
            organization=organization,
            provider_key=provider_key,
            flow=AuthHelper.FLOW_SETUP_PROVIDER,
        )

        if init:
            helper.init_pipeline()

        resp = helper.current_step()

        # TODO this seems gross, clean this up in AuthHelper maybe?
        if resp.status_code == 302:
            return Response({'auth_url': resp.get('Location')}, status=status.HTTP_200_OK)
        elif resp.status_code == 200:
            return Response({'template': resp.content.decode('utf-8')})

        # Not sure if we should just return this?
        return resp

    def put(self, request, organization):
        """
        Update an Auth Provider's settings
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :param boolean require_link: require members to link to SSO
        :param string default_role: set default role
        :auth: required
        """
        if not features.has('organizations:sso', organization, actor=request.user):
            return Response(ERR_NO_SSO, status=status.HTTP_403_FORBIDDEN)

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization,
            )
        except AuthProvider.DoesNotExist:
            raise ResourceDoesNotExist
        else:
            # TODO(billy) how do I validate form inputs and make sure this is boolean
            auth_provider.flags.allow_unlinked = not request.DATA.get(
                'require_link')
            auth_provider.save()

            # TODO(billy) make sure value is a valid role
            # It seems that `default_role` in `AuthProvider` model is not used
            organization.default_role = request.DATA.get('default_role')
            organization.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=auth_provider.id,
                event=AuditLogEntryEvent.SSO_EDIT,
                data=auth_provider.get_audit_log_data(),
            )

            return Response(serialize(auth_provider, request.user))

    def delete(self, request, organization):
        """
        Disable Auth Provider
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        if not features.has('organizations:sso', organization, actor=request.user):
            return Response(ERR_NO_SSO, status=status.HTTP_403_FORBIDDEN)

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization,
            )
        except AuthProvider.DoesNotExist:
            raise ResourceDoesNotExist
        else:
            self.create_audit_entry(
                request,
                organization=organization,
                target_object=auth_provider.id,
                event=AuditLogEntryEvent.SSO_DISABLE,
                data=auth_provider.get_audit_log_data(),
            )

            if db.is_sqlite():
                for om in OrganizationMember.objects.filter(organization=organization):
                    setattr(om.flags, 'sso:linked', False)
                    setattr(om.flags, 'sso:invalid', False)
                    om.save()
            else:
                OrganizationMember.objects.filter(
                    organization=organization,
                ).update(
                    flags=F('flags').bitand(
                        ~getattr(OrganizationMember.flags, 'sso:linked'),
                    ).bitand(
                        ~getattr(OrganizationMember.flags, 'sso:invalid'),
                    ),
                )

            auth_provider.delete()

            return Response({}, status=status.HTTP_200_OK)
