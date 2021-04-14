from django import forms
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry import eventstore
from sentry.models import Project, ProjectKey, ProjectOption, UserReport
from sentry.signals import user_feedback_received
from sentry.utils import json
from sentry.utils.http import absolute_uri, is_valid_origin, origin_from_request
from sentry.utils.validators import normalize_event_id
from sentry.web.helpers import render_to_response, render_to_string

GENERIC_ERROR = _("An unknown error occurred while submitting your report. Please try again.")
FORM_ERROR = _("Some fields were invalid. Please correct the errors and try again.")
SENT_MESSAGE = _("Your feedback has been sent. Thank you!")

DEFAULT_TITLE = _("It looks like we're having issues.")
DEFAULT_SUBTITLE = _("Our team has been notified.")
DEFAULT_SUBTITLE2 = _("If you'd like to help, tell us what happened below.")

DEFAULT_NAME_LABEL = _("Name")
DEFAULT_EMAIL_LABEL = _("Email")
DEFAULT_COMMENTS_LABEL = _("What happened?")

DEFAULT_CLOSE_LABEL = _("Close")
DEFAULT_SUBMIT_LABEL = _("Submit Crash Report")

DEFAULT_OPTIONS = {
    "title": DEFAULT_TITLE,
    "subtitle": DEFAULT_SUBTITLE,
    "subtitle2": DEFAULT_SUBTITLE2,
    "labelName": DEFAULT_NAME_LABEL,
    "labelEmail": DEFAULT_EMAIL_LABEL,
    "labelComments": DEFAULT_COMMENTS_LABEL,
    "labelClose": DEFAULT_CLOSE_LABEL,
    "labelSubmit": DEFAULT_SUBMIT_LABEL,
    "errorGeneric": GENERIC_ERROR,
    "errorFormEntry": FORM_ERROR,
    "successMessage": SENT_MESSAGE,
}


class UserReportForm(forms.ModelForm):
    name = forms.CharField(
        max_length=128, widget=forms.TextInput(attrs={"placeholder": _("Jane Bloggs")})
    )
    email = forms.EmailField(
        max_length=75,
        widget=forms.TextInput(attrs={"placeholder": _("jane@example.com"), "type": "email"}),
    )
    comments = forms.CharField(
        widget=forms.Textarea(attrs={"placeholder": _("I clicked on 'X' and then hit 'Confirm'")})
    )

    class Meta:
        model = UserReport
        fields = ("name", "email", "comments")


class ErrorPageEmbedView(View):
    def _get_project_key(self, request):
        try:
            dsn = request.GET["dsn"]
        except KeyError:
            return

        try:
            key = ProjectKey.from_dsn(dsn)
        except ProjectKey.DoesNotExist:
            return

        return key

    def _get_origin(self, request):
        return origin_from_request(request)

    def _smart_response(self, request, context=None, status=200):
        json_context = json.dumps(context or {})
        accept = request.META.get("HTTP_ACCEPT") or ""
        if "text/javascript" in accept:
            content_type = "text/javascript"
            content = ""
        else:
            content_type = "application/json"
            content = json_context
        response = HttpResponse(content, status=status, content_type=content_type)
        response["Access-Control-Allow-Origin"] = request.META.get("HTTP_ORIGIN", "")
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Max-Age"] = "1000"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response["Vary"] = "Accept"
        if content == "" and context:
            response["X-Sentry-Context"] = json_context
        return response

    @csrf_exempt
    def dispatch(self, request):
        try:
            event_id = request.GET["eventId"]
        except KeyError:
            return self._smart_response(
                request, {"eventId": "Missing or invalid parameter."}, status=400
            )

        normalized_event_id = normalize_event_id(event_id)
        if normalized_event_id:
            event_id = normalized_event_id
        elif event_id:
            return self._smart_response(
                request, {"eventId": "Missing or invalid parameter."}, status=400
            )

        key = self._get_project_key(request)
        if not key:
            return self._smart_response(
                request, {"dsn": "Missing or invalid parameter."}, status=404
            )

        origin = self._get_origin(request)
        if not is_valid_origin(origin, key.project):
            return self._smart_response(request, status=403)

        if request.method == "OPTIONS":
            return self._smart_response(request)

        # customization options
        options = DEFAULT_OPTIONS.copy()
        for name in options.keys():
            if name in request.GET:
                options[name] = str(request.GET[name])

        # TODO(dcramer): since we cant use a csrf cookie we should at the very
        # least sign the request / add some kind of nonce
        initial = {"name": request.GET.get("name"), "email": request.GET.get("email")}

        form = UserReportForm(request.POST if request.method == "POST" else None, initial=initial)
        if form.is_valid():
            # TODO(dcramer): move this to post to the internal API
            report = form.save(commit=False)
            report.project_id = key.project_id
            report.event_id = event_id

            event = eventstore.get_event_by_id(report.project_id, report.event_id)

            if event is not None:
                report.environment_id = event.get_environment().id
                report.group_id = event.group_id

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
                    project_id=report.project_id, event_id=report.event_id
                ).update(
                    name=report.name,
                    email=report.email,
                    comments=report.comments,
                    date_added=timezone.now(),
                )

            else:
                if report.group_id:
                    report.notify()

            user_feedback_received.send(
                project=Project.objects.get(id=report.project_id),
                sender=self,
            )

            return self._smart_response(request)
        elif request.method == "POST":
            return self._smart_response(request, {"errors": dict(form.errors)}, status=400)

        show_branding = (
            ProjectOption.objects.get_value(
                project=key.project, key="feedback:branding", default="1"
            )
            == "1"
        )

        template = render_to_string(
            "sentry/error-page-embed.html",
            context={
                "form": form,
                "show_branding": show_branding,
                "title": options["title"],
                "subtitle": options["subtitle"],
                "subtitle2": options["subtitle2"],
                "name_label": options["labelName"],
                "email_label": options["labelEmail"],
                "comments_label": options["labelComments"],
                "submit_label": options["labelSubmit"],
                "close_label": options["labelClose"],
            },
        )

        context = {
            "endpoint": mark_safe("*/" + json.dumps(absolute_uri(request.get_full_path())) + ";/*"),
            "template": mark_safe("*/" + json.dumps(template) + ";/*"),
            "strings": mark_safe(
                "*/"
                + json.dumps_htmlsafe(
                    {
                        "generic_error": str(options["errorGeneric"]),
                        "form_error": str(options["errorFormEntry"]),
                        "sent_message": str(options["successMessage"]),
                    }
                )
                + ";/*"
            ),
        }

        return render_to_response(
            "sentry/error-page-embed.js", context, request, content_type="text/javascript"
        )
