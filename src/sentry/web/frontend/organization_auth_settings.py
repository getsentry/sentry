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
from sentry.auth.superuser import is_active_superuser
from sentry.models import AuditLogEntryEvent, AuthProvider, OrganizationMember, User
from sentry.plugins.base import Response
from sentry.tasks.auth import email_missing_links, email_unlink_notifications
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import OrganizationView

ERR_NO_SSO = _("The SSO feature is not enabled for this organization.")

OK_PROVIDER_DISABLED = _("SSO authentication has been disabled.")

OK_REMINDERS_SENT = _(
    "A reminder email has been sent to members who have not yet linked their accounts."
)


class AuthProviderSettingsForm(forms.Form):
    require_link = forms.BooleanField(
        label=_("Require SSO"),
        help_text=_("Require members use a valid linked SSO account to access this organization"),
        required=False,
    )

    default_role = forms.ChoiceField(
        label=_("Default Role"),
        choices=roles.get_choices(),
        help_text=_(
            "The default role new members will receive when logging in for the first time."
        ),
    )


class OrganizationAuthSettingsView(OrganizationView):
    # We restrict auth settings to org:write as it allows a non-owner to
    # escalate members to own by disabling the default role.
    required_scope = "org:write"

    def _disable_provider(self, request, organization, auth_provider):
        self.create_audit_entry(
            request,
            organization=organization,
            target_object=auth_provider.id,
            event=AuditLogEntryEvent.SSO_DISABLE,
            data=auth_provider.get_audit_log_data(),
        )

        OrganizationMember.objects.filter(organization=organization).update(
            flags=F("flags")
            .bitand(~OrganizationMember.flags["sso:linked"])
            .bitand(~OrganizationMember.flags["sso:invalid"])
        )

        user_ids = OrganizationMember.objects.filter(organization=organization).values("user")
        User.objects.filter(id__in=user_ids).update(is_managed=False)

        email_unlink_notifications.delay(organization.id, request.user.id, auth_provider.provider)
        auth_provider.delete()

    def handle_existing_provider(self, request, organization, auth_provider):
        provider = auth_provider.get_provider()

        if request.method == "POST":
            op = request.POST.get("op")
            if op == "disable":
                self._disable_provider(request, organization, auth_provider)

                messages.add_message(request, messages.SUCCESS, OK_PROVIDER_DISABLED)

                next_uri = u"/settings/{}/auth/".format(organization.slug)
                return self.redirect(next_uri)
            elif op == "reinvite":
                email_missing_links.delay(organization.id, request.user.id, provider.key)

                messages.add_message(request, messages.SUCCESS, OK_REMINDERS_SENT)

                next_uri = reverse(
                    "sentry-organization-auth-provider-settings", args=[organization.slug]
                )
                return self.redirect(next_uri)

        form = AuthProviderSettingsForm(
            data=request.POST if request.POST.get("op") == "settings" else None,
            initial={
                "require_link": not auth_provider.flags.allow_unlinked,
                "default_role": organization.default_role,
            },
        )

        if form.is_valid():
            auth_provider.flags.allow_unlinked = not form.cleaned_data["require_link"]
            auth_provider.save()

            organization.default_role = form.cleaned_data["default_role"]
            organization.save()

            if form.initial != form.cleaned_data:
                changed_data = {}
                for key, value in form.cleaned_data.items():
                    if form.initial.get(key) != value:
                        changed_data[key] = u"to {}".format(value)

                self.create_audit_entry(
                    request,
                    organization=organization,
                    target_object=auth_provider.id,
                    event=AuditLogEntryEvent.SSO_EDIT,
                    data=changed_data,
                )

        view = provider.get_configure_view()
        response = view(request, organization, auth_provider)
        if isinstance(response, HttpResponse):
            return response
        elif isinstance(response, Response):
            response = response.render(
                request,
                {
                    "auth_provider": auth_provider,
                    "organization": organization,
                    "provider": provider,
                },
            )

        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        context = {
            "form": form,
            "pending_links_count": pending_links_count,
            "login_url": absolute_uri(organization.get_url()),
            "auth_provider": auth_provider,
            "provider_name": provider.name,
            "content": response,
        }

        return self.respond("sentry/organization-auth-provider-settings.html", context)

    @transaction.atomic
    def handle(self, request, organization):
        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            pass
        else:
            provider = auth_provider.get_provider()
            requires_feature = provider.required_feature

            # Provider is not enabled
            # Allow superusers to edit and disable SSO for orgs that
            # downgrade plans and can no longer access the feature
            if (
                requires_feature
                and not features.has(requires_feature, organization, actor=request.user)
                and not is_active_superuser(request)
            ):
                home_url = organization.get_url()
                messages.add_message(request, messages.ERROR, ERR_NO_SSO)

                return HttpResponseRedirect(home_url)

            return self.handle_existing_provider(
                request=request, organization=organization, auth_provider=auth_provider
            )

        if request.method == "POST":
            provider_key = request.POST.get("provider")
            if not manager.exists(provider_key):
                raise ValueError(u"Provider not found: {}".format(provider_key))

            helper = AuthHelper(
                request=request,
                organization=organization,
                provider_key=provider_key,
                flow=AuthHelper.FLOW_SETUP_PROVIDER,
            )

            feature = helper.provider.required_feature
            if feature and not features.has(feature, organization, actor=request.user):
                return HttpResponse("Provider is not enabled", status=401)

            if request.POST.get("init"):
                helper.init_pipeline()

            if not helper.pipeline_is_valid():
                return helper.error("Something unexpected happened during authentication.")

            # render first time setup view
            return helper.current_step()

        # Otherwise user is in bad state since frontend/react should handle this case
        return HttpResponseRedirect(organization.get_url())
