from __future__ import absolute_import

import six

from django import forms
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.views.generic import View
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

from sentry.models import (
    EventMapping, Group, ProjectKey, ProjectOption, UserReport
)
from sentry.web.helpers import render_to_response
from sentry.utils import json
from sentry.utils.http import is_valid_origin, origin_from_request
from sentry.utils.validators import is_event_id

GENERIC_ERROR = _('An unknown error occurred while submitting your report. Please try again.')
FORM_ERROR = _('Some fields were invalid. Please correct the errors and try again.')
SENT_MESSAGE = _('Your feedback has been sent. Thank you!')


class UserReportForm(forms.ModelForm):
    name = forms.CharField(max_length=128, widget=forms.TextInput(attrs={
        'placeholder': _('Jane Doe'),
    }))
    email = forms.EmailField(max_length=75, widget=forms.TextInput(attrs={
        'placeholder': _('jane@example.com'),
        'type': 'email',
    }))
    comments = forms.CharField(widget=forms.Textarea(attrs={
        'placeholder': _("I clicked on 'X' and then hit 'Confirm'"),
    }))

    class Meta:
        model = UserReport
        fields = ('name', 'email', 'comments')


class ErrorPageEmbedView(View):
    def _get_project_key(self, request):
        try:
            dsn = request.GET['dsn']
        except KeyError:
            return

        try:
            key = ProjectKey.from_dsn(dsn)
        except ProjectKey.DoesNotExist:
            return

        return key

    def _get_origin(self, request):
        return origin_from_request(request)

    def _json_response(self, request, context=None, status=200):
        if context:
            content = json.dumps(context)
        else:
            content = ''
        response = HttpResponse(content, status=status, content_type='application/json')
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '')
        response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response['Access-Control-Max-Age'] = '1000'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        return response

    @csrf_exempt
    def dispatch(self, request):
        try:
            event_id = request.GET['eventId']
        except KeyError:
            return self._json_response(request, status=400)

        if not is_event_id(event_id):
            return self._json_response(request, status=400)

        key = self._get_project_key(request)
        if not key:
            return self._json_response(request, status=404)

        origin = self._get_origin(request)
        if not origin:
            return self._json_response(request, status=403)

        if not is_valid_origin(origin, key.project):
            return HttpResponse(status=403)

        if request.method == 'OPTIONS':
            return self._json_response(request)

        # TODO(dcramer): since we cant use a csrf cookie we should at the very
        # least sign the request / add some kind of nonce
        initial = {
            'name': request.GET.get('name'),
            'email': request.GET.get('email'),
        }

        form = UserReportForm(request.POST if request.method == 'POST' else None,
                              initial=initial)
        if form.is_valid():
            # TODO(dcramer): move this to post to the internal API
            report = form.save(commit=False)
            report.project = key.project
            report.event_id = event_id
            try:
                mapping = EventMapping.objects.get(
                    event_id=report.event_id,
                    project_id=key.project_id,
                )
            except EventMapping.DoesNotExist:
                # XXX(dcramer): the system should fill this in later
                pass
            else:
                report.group = Group.objects.get(id=mapping.group_id)

            try:
                with transaction.atomic():
                    report.save()
            except IntegrityError:
                # There was a duplicate, so just overwrite the existing
                # row with the new one. The only way this ever happens is
                # if someone is messing around with the API, or doing
                # something wrong with the SDK, but this behavior is
                # more reasonable than just hard erroring and is more
                # expected.
                UserReport.objects.filter(
                    project=report.project,
                    event_id=report.event_id,
                ).update(
                    name=report.name,
                    email=report.email,
                    comments=report.comments,
                    date_added=timezone.now(),
                )
            return self._json_response(request)
        elif request.method == 'POST':
            return self._json_response(request, {
                "errors": dict(form.errors),
            }, status=400)

        show_branding = ProjectOption.objects.get_value(
            project=key.project,
            key='feedback:branding',
            default='1'
        ) == '1'

        template = render_to_string('sentry/error-page-embed.html', {
            'form': form,
            'show_branding': show_branding,
        })

        context = {
            'endpoint': mark_safe('*/' + json.dumps(request.build_absolute_uri()) + ';/*'),
            'template': mark_safe('*/' + json.dumps(template) + ';/*'),
            'strings': json.dumps_htmlsafe({
                'generic_error': six.text_type(GENERIC_ERROR),
                'form_error': six.text_type(FORM_ERROR),
                'sent_message': six.text_type(SENT_MESSAGE),
            }),
        }

        return render_to_response('sentry/error-page-embed.js', context, request,
                                  content_type='text/javascript')
