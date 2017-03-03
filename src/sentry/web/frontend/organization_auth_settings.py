from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse, HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import features, roles
from sentry.auth import manager
from sentry.auth.helper import AuthHelper
from sentry.models import AuditLogEntryEvent, AuthProvider, OrganizationMember
from sentry.plugins import Response
from sentry.tasks.auth import email_missing_links
from sentry.utils import db
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import OrganizationView

ERR_NO_SSO = _('The SSO feature is not enabled for this organization.')

OK_PROVIDER_DISABLED = _('SSO authentication has been disabled.')

OK_REMINDERS_SENT = _('A reminder email has been sent to members who have not yet linked their accounts.')


class AuthProviderSettingsForm(forms.Form):
    require_link = forms.BooleanField(
        label=_('Require SSO'),
        help_text=_('Require members use a valid linked SSO account to access this organization'),
        required=False,
    )
    default_role = forms.ChoiceField(
        label=_('Default Role'),
        choices=roles.get_choices(),
        help_text=_('The default role new members will receive when logging in for the first time.'),
    )


class OrganizationAuthSettingsView(OrganizationView):
    # We restrict auth settings to org:delete as it allows a non-owner to
    # escalate members to own by disabling the default role.
    required_scope = 'org:delete'

    def _disable_provider(self, request, organization, auth_provider):
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

    def handle_existing_provider(self, request, organization, auth_provider):
        provider = auth_provider.get_provider()

        if request.method == 'POST':
            op = request.POST.get('op')
            if op == 'disable':
                self._disable_provider(request, organization, auth_provider)

                messages.add_message(
                    request, messages.SUCCESS,
                    OK_PROVIDER_DISABLED,
                )

                next_uri = reverse('sentry-organization-auth-settings',
                                   args=[organization.slug])
                return self.redirect(next_uri)
            elif op == 'reinvite':
                email_missing_links.delay(organization_id=organization.id)

                messages.add_message(
                    request, messages.SUCCESS,
                    OK_REMINDERS_SENT,
                )

                next_uri = reverse('sentry-organization-auth-settings',
                                   args=[organization.slug])
                return self.redirect(next_uri)

        form = AuthProviderSettingsForm(
            data=request.POST if request.POST.get('op') == 'settings' else None,
            initial={
                'require_link': not auth_provider.flags.allow_unlinked,
                'default_role': organization.default_role,
            },
        )

        if form.is_valid():
            auth_provider.flags.allow_unlinked = not form.cleaned_data['require_link']
            auth_provider.save()

            organization.default_role = form.cleaned_data['default_role']
            organization.save()

        view = provider.get_configure_view()
        response = view(request, organization, auth_provider)
        if isinstance(response, HttpResponse):
            return response
        elif isinstance(response, Response):
            response = response.render(request, {
                'auth_provider': auth_provider,
                'organization': organization,
                'provider': provider,
            })

        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=~getattr(OrganizationMember.flags, 'sso:linked'),
        ).count()

        context = {
            'form': form,
            'pending_links_count': pending_links_count,
            'login_url': absolute_uri(reverse('sentry-organization-home', args=[organization.slug])),
            'auth_provider': auth_provider,
            'provider_name': provider.name,
            'content': response,
        }

        return self.respond('sentry/organization-auth-provider-settings.html', context)

    def handle_provider_setup(self, request, organization, provider_key):
        helper = AuthHelper(
            request=request,
            organization=organization,
            provider_key=provider_key,
            flow=AuthHelper.FLOW_SETUP_PROVIDER,
        )
        helper.init_pipeline()
        return helper.next_step()

    @transaction.atomic
    def handle(self, request, organization):
        if not features.has('organizations:sso', organization, actor=request.user):
            messages.add_message(
                request, messages.ERROR,
                ERR_NO_SSO,
            )
            return HttpResponseRedirect(reverse('sentry-organization-home', args=[organization.slug]))

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization,
            )
        except AuthProvider.DoesNotExist:
            pass
        else:
            return self.handle_existing_provider(
                request=request,
                organization=organization,
                auth_provider=auth_provider,
            )

        if request.method == 'POST':
            provider_key = request.POST.get('provider')
            if not manager.exists(provider_key):
                raise ValueError('Provider not found: {}'.format(provider_key))

            # render first time setup view
            return self.handle_provider_setup(request, organization, provider_key)

        context = {
            'provider_list': [(k, v.name) for k, v in manager],
        }

        return self.respond('sentry/organization-auth-settings.html', context)
