from __future__ import absolute_import

from mistune import markdown


from sentry.integrations.issues import IssueSyncMixin
from django.utils.translation import ugettext as _


class VstsIssueSync(IssueSyncMixin):
    description = 'Integrate Visual Studio Team Services work items by linking a project.'
    slug = 'vsts'
    conf_key = slug

    issue_fields = frozenset(['id', 'title', 'url'])

    def get_create_issue_config(self, group, **kwargs):
        fields = super(VstsIssueSync, self).get_create_issue_config(group, **kwargs)
        client = self.get_client()
        try:
            projects = client.get_projects(self.instance)['value']
        except Exception as e:
            self.raise_error(e)

        project_choices = []
        initial_project = ('', '')
        for project in projects:
            project_choices.append((project['id'], project['name']))
            if project['id'] == self.default_project:
                initial_project = project['name']
        return [
            {
                'name': 'project',
                'required': True,
                'name': 'project',
                'type': 'choice',
                'choices': project_choices,
                'defaultValue': initial_project,
                'label': _('Project'),
                'placeholder': initial_project or _('MyProject'),
            }
        ] + fields

    def get_link_issue_config(self, group, **kwargs):
        fields = super(VstsIssueSync, self).get_link_issue_config(group, **kwargs)
        return fields

    def create_issue(self, data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        project = data.get('project') or self.default_project
        if project is None:
            raise ValueError('VSTS expects project')
        client = self.get_client()

        title = data['title']
        description = data['description']
        # TODO(LB): Why was group removed from method?
        # link = absolute_uri(group.get_absolute_url())
        try:
            created_item = client.create_work_item(
                instance=self.instance,
                project=project,
                title=title,
                # Decriptions cannot easily be seen. So, a comment will be added as well.
                description=markdown(description),
                comment=markdown(description)
                # link=link,
            )
        except Exception as e:
            self.raise_error(e)

        return {
            'key': created_item['id'],
            # 'url': created_item['_links']['html']['href'],
            'title': title,
            'description': description,
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        work_item = client.get_work_item(self.instance, issue_id)
        return {
            'key': work_item['id'],
            'title': work_item['fields']['System.Title'],
            'description': work_item['fields']['System.Description']
        }
