from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponse
from django.views.generic import View
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe

from sentry.models import Group, ProjectKey, UserReport
from sentry.web.helpers import render_to_response
from sentry.utils import json
from sentry.utils.http import absolute_uri, is_valid_origin


class UserReportForm(forms.ModelForm):
    event_id = forms.CharField(max_length=32, widget=forms.HiddenInput)
    dsn = forms.CharField(max_length=128, widget=forms.HiddenInput)
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
        fields = ('name', 'email', 'comments', 'event_id')


class ErrorPageEmbedView(View):
    def _get_project_key(self, request):
        dsn = request.POST.get('dsn', request.GET.get('dsn'))
        try:
            key = ProjectKey.from_dsn(dsn)
        except ProjectKey.DoesNotExist:
            return

        return key

    def _get_origin(self, request):
        return request.META.get('HTTP_ORIGIN', request.META.get('HTTP_REFERER'))

    def dispatch(self, request):
        try:
            initial = {
                'dsn': request.GET['dsn'],
                'eventId': request.GET['eventId'],
            }
        except KeyError:
            return HttpResponse(status=400)

        key = self._get_project_key(request)
        if not key:
            return HttpResponse(status=404)

        origin = self._get_origin(request)
        if not origin:
            return HttpResponse(status=403)

        if not is_valid_origin(origin, key.project):
            return HttpResponse(status=403)

        form = UserReportForm(request.POST or None, initial=initial)
        if form.is_valid():
            report = form.save(commit=False)
            report.project = key.project
            report.event_id = form.cleaned_data['event_id']
            try:
                report.group = Group.objects.get(
                    eventmapping__event_id=report.event_id,
                    eventmapping__project=key.project,
                )
            except Group.DoesNotExist:
                # XXX(dcramer): the system should fill this in later
                pass
            report.save()

            return HttpResponse(status=200)
        elif request.method == 'POST':
            return HttpResponse(status=400)

        form = UserReportForm(initial=initial)

        template = render_to_string('sentry/error-page-embed.html', {
            'form': form,
        })

        context = {
            'endpoint': mark_safe(json.dumps(absolute_uri(reverse('sentry-error-page-embed')))),
            'template': mark_safe(json.dumps(template)),
        }

        return render_to_response('sentry/error-page-embed.js', context, request,
                                  content_type='text/javascript')
