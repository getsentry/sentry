from django.db import transaction
from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.core.context_processors import csrf

from sudo.decorators import sudo_required

from sentry.models import Authenticator
from sentry.web.frontend.base import BaseView
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response
from sentry.web.forms.accounts import TwoFactorForm


class TwoFactorSettingsView(BaseView):
    interface_id = None
    configure_template = 'sentry/account/twofactor/configure.html'

    @method_decorator(csrf_protect)
    @method_decorator(never_cache)
    @method_decorator(login_required)
    @method_decorator(sudo_required)
    @method_decorator(transaction.atomic)
    def handle(self, request):
        interface = Authenticator.objects.get_interface(
            request.user, self.interface_id)
        if 'remove' in request.POST:
            return self.remove(request, interface)
        return self.configure(request, interface)

    def make_context(self, request, interface):
        context = csrf(request)
        context['auth'] = interface
        context['page'] = 'settings'
        context['is_missing_backup_interfaces'] = \
            Authenticator.objects.is_missing_backup_interfaces(request.user)
        return context

    def delete_authenticator(self, interface):
        if interface.authenticator is None:
            return

        user = interface.authenticator.user
        interface.authenticator.delete()

        # If this was an authenticator that was a backup interface we just
        # deleted, then nothing happens.
        if interface.backup_interface:
            return

        # If however if we delete an actual authenticator and all that
        # remainds are backup interfaces, then we kill them in the
        # process.
        interfaces = Authenticator.objects.all_interfaces_for_user(user)
        backup_interfaces = [x for x in interfaces if x.backup_interface]
        if len(backup_interfaces) == len(interfaces):
            for iface in backup_interfaces:
                iface.authenticator.delete()

    def remove(self, request, interface):
        if 'no' in request.POST or \
           not interface.is_enrolled:
            return HttpResponseRedirect(reverse('sentry-account-settings-2fa'))
        elif 'yes' in request.POST:
            self.delete_authenticator(interface)
            return HttpResponseRedirect(reverse('sentry-account-settings-2fa'))
        context = self.make_context(request, interface)
        return render_to_response('sentry/account/twofactor/remove.html',
                                  context, request)

    def enroll(self, request, interface):
        interface.enroll(request.user)
        return HttpResponseRedirect(request.path)

    def configure(self, request, interface):
        if 'enroll' in request.POST and not interface.is_enrolled:
            return self.enroll(request, interface)
        context = self.make_context(request, interface)
        return render_to_response(self.configure_template,
                                  context, request)


class RecoveryCodeSettingsView(TwoFactorSettingsView):
    interface_id = 'recovery'
    configure_template = 'sentry/account/twofactor/configure_recovery.html'


class TotpSettingsView(TwoFactorSettingsView):
    interface_id = 'totp'

    def enroll(self, request, interface):
        totp_secret = request.POST.get('totp_secret')
        if totp_secret is not None:
            interface.config['secret'] = totp_secret

        form = TwoFactorForm(request.POST)
        if 'otp' in request.POST and form.is_valid():
            if interface.validate_otp(form.cleaned_data['otp']):
                return TwoFactorSettingsView.enroll(self, request, interface)
            else:
                form.errors['__all__'] = ['Invalid confirmation code.']

        context = self.make_context(request, interface)
        context['otp_form'] = form
        context['provision_qrcode'] = interface.get_provision_qrcode(
            request.user.email)
        return render_to_response('sentry/account/twofactor/enroll_totp.html',
                                  context, request)
