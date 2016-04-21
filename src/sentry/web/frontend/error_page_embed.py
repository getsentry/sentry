from __future__ import absolute_import

from django import forms
from django.http import HttpResponse
from django.views.generic import View
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_exempt

from sentry.models import EventMapping, Group, ProjectKey, UserReport
from sentry.web.helpers import render_to_response
from sentry.utils import json
from sentry.utils.http import is_valid_origin


class UserReportForm(forms.ModelForm):
    name = forms.CharField(max_length=128, widget=forms.TextInput(attrs={
        'placeholder': 'Jane Doe',
    }))
    email = forms.EmailField(max_length=75, widget=forms.TextInput(attrs={
        'placeholder': 'jane@example.com',
        'type': 'email',
    }))
    comments = forms.CharField(widget=forms.Textarea(attrs={
        'placeholder': "I clicked on 'X' and then hit 'Confirm'",
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
        return request.META.get('HTTP_ORIGIN', request.META.get('HTTP_REFERER'))

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
            report.save()
            return self._json_response(request)
        elif request.method == 'POST':
            return self._json_response(request, {
                "errors": dict(form.errors),
            }, status=400)

        template = render_to_string('sentry/error-page-embed.html', {
            'form': form,
        })

        context = {
            'endpoint': mark_safe('*/' + json.dumps(request.build_absolute_uri()) + ';/*'),
            'template': mark_safe('*/' + json.dumps(template) + ';/*'),
        }

        return render_to_response('sentry/error-page-embed.js', context, request,
                                  content_type='text/javascript')
