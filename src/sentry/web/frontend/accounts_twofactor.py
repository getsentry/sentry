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

import petname
from sudo.decorators import sudo_required

from sentry.models import Authenticator
from sentry.web.frontend.base import BaseView
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response
from sentry.web.forms.accounts import TwoFactorForm, ConfirmPasswordForm
from sentry.utils import json


class SmsForm(forms.Form):
    phone_number = forms.CharField(
        label=_('Phone number'), max_length=40
    )


class U2fForm(forms.Form):
    device_name = forms.CharField(
        label=_('Device name'), max_length=60, required=False,
        initial=lambda: petname.Generate(2, ' ').title(),
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
        return self.configure(request, interface)

    def make_context(self, request, interface):
        context = csrf(request)
        context['auth'] = interface
        context['page'] = 'security'
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
        form = ConfirmPasswordForm(request.user)

        if 'no' in request.POST or \
           not interface.is_enrolled:
            return HttpResponseRedirect(reverse('sentry-account-settings-2fa'))
        elif 'yes' in request.POST:
            form = ConfirmPasswordForm(request.user, request.POST)
            if 'password' in form.fields:
                if form.is_valid():
                    if request.user.check_password(form.cleaned_data['password']):
                        self.delete_authenticator(interface)
                        return HttpResponseRedirect(reverse('sentry-account-settings-2fa'))
                    else:
                        form.errors['__all__'] = ['Invalid password.']
            else:
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
        context['password_form'] = form
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
            try:
                interface.enroll(request.user)
            except Authenticator.AlreadyEnrolled:
                # This can happen in some cases when races occur.  We have
                # seen this when people press the submit button twice.  In
                # that case just go to the overview page of 2fa
                next = reverse('sentry-account-settings-2fa')
            else:
                request.user.refresh_session_nonce(self.request)
                request.user.save()
                if Authenticator.objects.auto_add_recovery_codes(request.user):
                    next = reverse('sentry-account-settings-2fa-recovery')
        return HttpResponseRedirect(next)

    def configure(self, request, interface):
        if 'remove' in request.POST:
            return self.remove(request, interface)
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
            password_form = ConfirmPasswordForm(request.user, request.POST)
            if 'password' in password_form.fields and password_form.is_valid():
                if request.user.check_password(password_form.cleaned_data['password']):
                    if form.is_valid() and interface.validate_otp(
                            form.cleaned_data['otp']):
                        return TwoFactorSettingsView.enroll(self, request, interface)
                    else:
                        form.errors['__all__'] = ['Invalid confirmation code.']
                else:
                    form.errors['__all__'] = ['Invalid password.']
            else:
                if form.is_valid() and interface.validate_otp(
                        form.cleaned_data['otp']):
                    return TwoFactorSettingsView.enroll(self, request, interface)
                else:
                    form.errors['__all__'] = ['Invalid confirmation code.']

        else:
            form = TwoFactorForm()
            password_form = ConfirmPasswordForm(request.user)

        context = self.make_context(request, interface)
        context['otp_form'] = form
        context['password_form'] = password_form
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

    def configure(self, request, interface):
        # Try to remove a key handle.  If this returns `False` it means we
        # are about to remove the last key handle.  In that case just
        # bubble through to the configure page which will pick up the
        # 'remove' in the form and bring up the remove screen for the
        # entire authentication method.
        key_handle = request.POST.get('key_handle')
        if key_handle and 'remove' in request.POST and \
           interface.remove_u2f_device(key_handle):
            interface.authenticator.save()
            return HttpResponseRedirect(request.path)

        return TwoFactorSettingsView.configure(self, request, interface)

    def enroll(self, request, interface, insecure=False):
        u2f_form = U2fForm()

        challenge = request.POST.get('challenge')
        if challenge:
            enrollment_data = json.loads(challenge)
        else:
            enrollment_data = interface.start_enrollment()

        response = request.POST.get('response')
        if response:
            u2f_form = U2fForm(request.POST)
            if u2f_form.is_valid():
                interface.try_enroll(enrollment_data, json.loads(response),
                                     u2f_form.cleaned_data['device_name'])
                return TwoFactorSettingsView.enroll(self, request, interface)

        context = self.make_context(request, interface)
        context['enrollment_data'] = enrollment_data
        context['u2f_form'] = u2f_form
        return render_to_response('sentry/account/twofactor/enroll_u2f.html',
                                  context, request)
