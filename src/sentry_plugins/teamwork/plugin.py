from __future__ import absolute_import

import six
from django import forms
from django.utils.translation import ugettext_lazy as _
from django.http import HttpResponse
from requests.exceptions import RequestException


import sentry
from sentry.plugins.base import JSONResponse
from sentry.plugins.bases.issue import IssuePlugin, NewIssueForm
from sentry.utils.http import absolute_uri

from .client import TeamworkClient


class TeamworkSettingsForm(forms.Form):
    url = forms.URLField(label=_("Teamwork URL"), help_text=("i.e. http://sentry.teamwork.com"))
    token = forms.CharField(label=_("Teamwork API Token"))


class TeamworkTaskForm(NewIssueForm):
    title = forms.CharField(
        label=_("Title"), max_length=200, widget=forms.TextInput(attrs={"class": "span9"})
    )
    description = forms.CharField(
        label=_("Description"), widget=forms.Textarea(attrs={"class": "span9"})
    )
    project = forms.ChoiceField(label=_("Project"), choices=())
    tasklist = forms.ChoiceField(label=_("Task List"), choices=())

    create_issue_template = "sentry_teamwork/create_issue.html"

    def __init__(self, client, data=None, initial=None):
        super(TeamworkTaskForm, self).__init__(data=data, initial=initial)

        try:
            project_list = client.list_projects()
        except RequestException as e:
            raise forms.ValidationError(_("Error contacting Teamwork API: %s") % six.text_type(e))

        self.fields["project"].choices = [(six.text_type(i["id"]), i["name"]) for i in project_list]
        self.fields["project"].widget.choices = self.fields["project"].choices

        if self.data.get("project"):
            try:
                tasklist_list = client.list_tasklists(data["project"])
            except RequestException as e:
                raise forms.ValidationError(
                    _("Error contacting Teamwork API: %s") % six.text_type(e)
                )
            self.fields["tasklist"].choices = [
                (six.text_type(i["id"]), i["name"]) for i in tasklist_list
            ]
            self.fields["tasklist"].widget.choices = self.fields["tasklist"].choices


class TeamworkPlugin(IssuePlugin):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    title = _("Teamwork")
    description = _("Create Teamwork Tasks.")
    slug = "teamwork"

    conf_title = title
    conf_key = slug

    version = sentry.VERSION
    project_conf_form = TeamworkSettingsForm

    new_issue_form = TeamworkTaskForm
    create_issue_template = "sentry_teamwork/create_issue.html"

    def _get_group_description(self, request, group, event):
        """
        Return group description in markdown-compatible format.

        This overrides an internal method to IssuePlugin.
        """
        output = [absolute_uri(group.get_absolute_url())]
        body = self._get_group_body(request, group, event)
        if body:
            output.extend(["", "\n".join("    " + line for line in body.splitlines())])
        return "\n".join(output)

    def is_configured(self, request, project, **kwargs):
        return all((self.get_option(key, project) for key in ("url", "token")))

    def get_client(self, project):
        return TeamworkClient(
            base_url=self.get_option("url", project), token=self.get_option("token", project)
        )

    def get_new_issue_form(self, request, group, event, **kwargs):
        """
        Return a Form for the "Create new issue" page.
        """
        return self.new_issue_form(
            client=self.get_client(group.project),
            data=request.POST or None,
            initial=self.get_initial_form_data(request, group, event),
        )

    def get_issue_url(self, group, issue_id, **kwargs):
        url = self.get_option("url", group.project)
        return "%s/tasks/%s" % (url.rstrip("/"), issue_id)

    def get_new_issue_title(self, **kwargs):
        return _("Create Teamwork Task")

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)
        try:
            task_id = client.create_task(
                content=form_data["title"],
                description=form_data["description"],
                tasklist_id=form_data["tasklist"],
            )
        except RequestException as e:
            raise forms.ValidationError(_("Error creating Teamwork task: %s") % six.text_type(e))

        return task_id

    def view(self, request, group, **kwargs):
        op = request.GET.get("op")
        # TODO(dcramer): add caching
        if op == "getTaskLists":
            project_id = request.GET.get("pid")
            if not project_id:
                return HttpResponse(status=400)

            client = self.get_client(group.project)
            task_list = client.list_tasklists(project_id)
            return JSONResponse([{"id": i["id"], "text": i["name"]} for i in task_list])

        return super(TeamworkPlugin, self).view(request, group, **kwargs)
