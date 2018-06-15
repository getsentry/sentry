from __future__ import absolute_import

from mistune import markdown


from sentry.integrations.issues import IssueSyncMixin
from django.utils.translation import ugettext as _
# from sentry.utils.http import absolute_uri


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
                comment=markdown(description),
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
        raise NotImplementedError

    # def get_issue_label(self, group, issue, **kwargs):
    #     return 'Bug {}'.format(issue['id'])

    # def get_issue_url(self, group, issue, **kwargs):
    #     return issue['url']

    # def get_link_existing_issue_fields(self, request, group, event, **kwargs):
    #     return [
    #         {
    #             'name': 'item_id',
    #             'label': 'Work Item ID',
    #             'default': '',
    #             'type': 'text',
    #         },
    #         {
    #             'name': 'comment',
    #             'label': 'Comment',
    #             'default': 'I\'ve identified this issue in Sentry: {}'.format(
    #                 absolute_uri(group.get_absolute_url()),
    #             ),
    #             'type': 'textarea',
    #             'help': ('Markdown is supported. Leave blank if you don\'t want to add a comment.'),
    #             'required': False
    #         }
    #     ]

    # def link_issue(self, request, group, form_data, **kwargs):
    #     client = self.get_client()
    #     if form_data.get('comment'):
    #         try:
    #             work_item = client.update_work_item(
    #                 instance=self.instance,
    #                 id=form_data['item_id'],
    #                 link=absolute_uri(group.get_absolute_url()),
    #                 comment=markdown(form_data['comment']) if form_data.get(
    #                     'comment') else None,
    #             )
    #         except Exception as e:
    #             self.raise_error(e)
    #     else:
    #         try:
    #             work_item = client.get_work_item(
    #                 instance=self.instance,
    #                 id=form_data['item_id'],
    #             )
    #         except Exception as e:
    #             self.raise_error(e)

    #     return {
    #         'id': work_item['id'],
    #         'url': work_item['_links']['html']['href'],
    #         'title': work_item['fields']['System.Title'],
    #     }
