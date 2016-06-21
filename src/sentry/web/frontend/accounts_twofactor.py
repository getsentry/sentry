from __future__ import absolute_import

from django import forms
from django.db import transaction
from django.http import HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.core.context_processors import csrf
from django.utils.translation import ugettext_lazy as _

from sudo.decorators import sudo_required

from sentry.models import Authenticator
from sentry.web.frontend.base import BaseView
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response
from sentry.web.forms.accounts import TwoFactorForm
from sentry.utils import json


class SmsForm(forms.Form):
    phone_number = forms.CharField(
        label=_('Phone number'), max_length=40
    )


class TwoFactorSettingsView(BaseView):
    interface_id = None

    @method_decorator(csrf_protect)
    @method_decorator(never_cache)
    @method_decorator(login_required)
    @method_decorator(sudo_required)
    @method_decorator(transaction.atomic)
    def handle(self, request):
        try:
            interface = Authenticator.objects.get_interface(
                request.user, self.interface_id)
        except LookupError:
            raise Http404
        if 'remove' in request.POST:
            return self.remove(request, interface)
        return self.configure(request, interface)

    def make_context(self, request, interface):
        context = csrf(request)
        context['auth'] = interface
        context['page'] = 'settings'
        return context

    def delete_authenticator(self, interface):
        if interface.authenticator is None:
            return

        user = interface.authenticator.user
        interface.authenticator.delete()

        # If this was an authenticator that was a backup interface we just
        # deleted, then nothing happens.
        if interface.is_backup_interface:
            return

        # If however if we delete an actual authenticator and all that
        # remainds are backup interfaces, then we kill them in the
        # process.
        interfaces = Authenticator.objects.all_interfaces_for_user(user)
        backup_interfaces = [x for x in interfaces if x.is_backup_interface]
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

        all_interfaces = Authenticator.objects.all_interfaces_for_user(
            request.user)
        other_interfaces = [x for x in all_interfaces
                            if x.interface_id != interface.interface_id]
        backup_interfaces = [x for x in other_interfaces if x.is_backup_interface]
        removes_backups = backup_interfaces and \
            len(backup_interfaces) == len(other_interfaces)

        context = self.make_context(request, interface)
        context['removes_backups'] = removes_backups
        return render_to_response('sentry/account/twofactor/remove.html',
                                  context, request)

    def enroll(self, request, interface, insecure=False):
        next = request.path
        # Only enroll if it's either not an insecure enrollment or we are
        # enrolling a backup interface when we already had a primary one.
        if not insecure \
           or (interface.is_backup_interface and
               Authenticator.objects.user_has_2fa(request.user)):
            interface.enroll(request.user)
            if Authenticator.objects.auto_add_recovery_codes(request.user):
                next = reverse('sentry-account-settings-2fa-recovery')
        return HttpResponseRedirect(next)

    def configure(self, request, interface):
        if 'enroll' in request.POST or \
           request.GET.get('enroll') == 'yes':
            return self.enroll(request, interface,
                               insecure='enroll' not in request.POST)
        context = self.make_context(request, interface)
        return render_to_response(['sentry/account/twofactor/configure_%s.html'
                                   % self.interface_id,
                                   'sentry/account/twofactor/configure.html'],
                                  context, request)


class RecoveryCodeSettingsView(TwoFactorSettingsView):
    interface_id = 'recovery'

    def configure(self, request, interface):
        if 'regenerate' in request.POST:
            interface.regenerate_codes()
            return HttpResponseRedirect(request.path)
        return TwoFactorSettingsView.configure(self, request, interface)


class TotpSettingsView(TwoFactorSettingsView):
    interface_id = 'totp'

    def enroll(self, request, interface, insecure=False):
        totp_secret = request.POST.get('totp_secret')
        if totp_secret is not None:
            interface.secret = totp_secret

        if 'otp' in request.POST:
            form = TwoFactorForm(request.POST)
            if form.is_valid() and interface.validate_otp(
                    form.cleaned_data['otp']):
                return TwoFactorSettingsView.enroll(self, request, interface)
            else:
                form.errors['__all__'] = ['Invalid confirmation code.']
        else:
            form = TwoFactorForm()

        context = self.make_context(request, interface)
        context['otp_form'] = form
        context['provision_qrcode'] = interface.get_provision_qrcode(
            request.user.email)
        return render_to_response('sentry/account/twofactor/enroll_totp.html',
                                  context, request)


class SmsSettingsView(TwoFactorSettingsView):
    interface_id = 'sms'

    def enroll(self, request, interface, insecure=False):
        stage = request.POST.get('stage') or 'initial'

        totp_secret = request.POST.get('totp_secret')
        if totp_secret is not None:
            interface.secret = totp_secret

        phone_number = request.POST.get('phone_number')
        if phone_number is not None:
            interface.phone_number = phone_number

        sms_form = SmsForm()
        otp_form = TwoFactorForm()

        if stage == 'pick_number':
            sms_form = SmsForm(request.POST)
            if sms_form.is_valid():
                interface.send_text(for_enrollment=True, request=request)
                stage = 'confirm'
        elif stage == 'confirm':
            otp_form = TwoFactorForm(request.POST)
            if otp_form.is_valid() and interface.validate_otp(
                    otp_form.cleaned_data['otp']):
                return TwoFactorSettingsView.enroll(self, request, interface)
            else:
                otp_form.errors['__all__'] = ['Invalid confirmation code.']

        context = self.make_context(request, interface)
        context['sms_form'] = sms_form
        context['otp_form'] = otp_form
        context['stage'] = stage
        return render_to_response('sentry/account/twofactor/enroll_sms.html',
                                  context, request)


class U2fSettingsView(TwoFactorSettingsView):
    interface_id = 'u2f'

    def enroll(self, request, interface, insecure=False):
        challenge = request.POST.get('challenge')
        if challenge:
            interface.enrollment_data = json.loads(challenge)

        response = request.POST.get('response')
        if response:
            interface.try_enroll(json.loads(response))
            return TwoFactorSettingsView.enroll(self, request, interface)

        context = self.make_context(request, interface)
        return render_to_response('sentry/account/twofactor/enroll_u2f.html',
                                  context, request)
