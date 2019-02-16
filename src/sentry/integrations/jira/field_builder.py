from __future__ import absolute_import

import logging
import six

from sentry.integrations.exceptions import ApiUnauthorized, ApiError, IntegrationError

# hide sprint, epic link, parent and linked issues fields because they don't work
# since sprint and epic link are "custom" we need to search for them by name
HIDDEN_ISSUE_FIELDS = {
    'keys': ['parent', 'issuelinks'],
    'names': ['Sprint', 'Epic Link'],
}

# A list of common builtin custom field types for Jira for easy reference.
JIRA_CUSTOM_FIELD_TYPES = {
    'select': 'com.atlassian.jira.plugin.system.customfieldtypes:select',
    'textarea': 'com.atlassian.jira.plugin.system.customfieldtypes:textarea',
    'multiuserpicker': 'com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker',
    'tempo_account': 'com.tempoplugin.tempo-accounts:accounts.customfield'
}

logger = logging.getLogger('sentry.integrations.jira')


class JiraFieldBuilder(object):
    """
    This is to put all the Jira-specific stuff here.

    Meta ... which means what?
    """

    def get_project_meta_for_issue(self, group, project_id):
        client = self.get_client()
        try:
            meta = client.get_create_meta_for_project(project_id)
        except ApiUnauthorized:
            raise IntegrationError(
                'Jira returned: Unauthorized. '
                'Please check your configuration settings.'
            )
        except ApiError as exc:
            logger.info(
                'jira.error-fetching-issue-config',
                extra={
                    'integration_id': self.model.id,
                    'organization_id': group.organization.id,
                    'error': exc.message,
                }
            )
            raise IntegrationError(
                'There was an error communicating with the Jira API. '
                'Please try again or contact support.'
            )
        return meta

    def get_issue_ignored_fields(self, issue_type_meta):
        # TODO(jess): are we going to allow ignored fields?
        # ignored_fields = (self.get_option('ignored_fields', group.project) or '').split(',')
        ignored_fields = set(
            k for k, v in six.iteritems(issue_type_meta['fields'])
            if v['name'] in HIDDEN_ISSUE_FIELDS['names']
        )
        ignored_fields.update(HIDDEN_ISSUE_FIELDS['keys'])
        return ignored_fields

    def update_issue_fields_with_dynamic_fields(
            self, group, issue_type_meta, defaults, meta, fields):
        client = self.get_client()
        # title is renamed to summary before sending to Jira
        standard_fields = [f['name'] for f in fields] + ['summary']

        ignored_fields = self.get_issue_ignored_fields(issue_type_meta)

        # apply ordering to fields based on some known built-in Jira fields.
        # otherwise weird ordering occurs.
        anti_gravity = {"priority": -150, "fixVersions": -125, "components": -100, "security": -50}

        dynamic_fields = issue_type_meta['fields'].keys()
        dynamic_fields.sort(key=lambda f: anti_gravity.get(f) or 0)

        # build up some dynamic fields based on required shit.
        for field in dynamic_fields:
            if field in standard_fields or field in [x.strip() for x in ignored_fields]:
                # don't overwrite the fixed fields for the form.
                continue
            mb_field = self.build_dynamic_field(group, issue_type_meta['fields'][field])
            if mb_field:
                mb_field['name'] = field
                fields.append(mb_field)

        for field in fields:
            if field['name'] == 'priority':
                # whenever priorities are available, put the available ones in the list.
                # allowedValues for some reason doesn't pass enough info.
                field['choices'] = self.make_choices(client.get_priorities())
                field['default'] = defaults.get('priority', '')
            elif field['name'] == 'fixVersions':
                field['choices'] = self.make_choices(client.get_versions(meta['key']))

    def clean_create_issue_data(self, issue_type_meta, data):
        cleaned_data = {}
        fs = issue_type_meta['fields']
        for field in fs.keys():
            f = fs[field]
            if field == 'description':
                cleaned_data[field] = data[field]
                continue
            elif field == 'summary':
                cleaned_data['summary'] = data['title']
                continue
            elif field == 'labels' and 'labels' in data:
                labels = [
                    label.strip()
                    for label in data['labels'].split(',')
                    if label.strip()
                ]
                cleaned_data['labels'] = labels
                continue
            if field in data.keys():
                v = data.get(field)
                if not v:
                    continue

                schema = f.get('schema')
                if schema:
                    if schema.get('type') == 'string' and not schema.get('custom'):
                        cleaned_data[field] = v
                        continue
                    if schema['type'] == 'user' or schema.get('items') == 'user':
                        v = {'name': v}
                    elif schema.get('custom') == JIRA_CUSTOM_FIELD_TYPES.get('multiuserpicker'):
                        # custom multi-picker
                        v = [{'name': v}]
                    elif schema['type'] == 'array' and schema.get('items') != 'string':
                        v = [{'id': vx} for vx in v]
                    elif schema['type'] == 'array' and schema.get('items') == 'string':
                        v = [v]
                    elif schema.get('custom') == JIRA_CUSTOM_FIELD_TYPES.get('textarea'):
                        v = v
                    elif (schema['type'] == 'number'
                          or schema.get('custom') == JIRA_CUSTOM_FIELD_TYPES['tempo_account']):
                        try:
                            if '.' in v:
                                v = float(v)
                            else:
                                v = int(v)
                        except ValueError:
                            pass
                    elif (schema.get('type') != 'string'
                            or (schema.get('items') and schema.get('items') != 'string')
                            or schema.get('custom') == JIRA_CUSTOM_FIELD_TYPES.get('select')):
                        v = {'id': v}
                cleaned_data[field] = v

        if not (isinstance(cleaned_data['issuetype'], dict) and 'id' in cleaned_data['issuetype']):
            # something fishy is going on with this field, working on some Jira
            # instances, and some not.
            # testing against 5.1.5 and 5.1.4 does not convert (perhaps is no longer included
            # in the projectmeta API call, and would normally be converted in the
            # above clean method.)
            cleaned_data['issuetype'] = {'id': cleaned_data['issuetype']}

        return cleaned_data

    def build_dynamic_field(self, group, field_meta):
        """
        Builds a field based on Jira's meta field information
        """
        schema = field_meta['schema']

        # set up some defaults for form fields
        fieldtype = 'text'
        fkwargs = {
            'label': field_meta['name'],
            'required': field_meta['required'],
        }
        # override defaults based on field configuration
        if (schema['type'] in ['securitylevel', 'priority']
                or schema.get('custom') == JIRA_CUSTOM_FIELD_TYPES['select']):
            fieldtype = 'select'
            fkwargs['choices'] = self.make_choices(field_meta.get('allowedValues'))
        elif field_meta.get('autoCompleteUrl') and \
                (schema.get('items') == 'user' or schema['type'] == 'user'):
            fieldtype = 'select'
            fkwargs['url'] = self.search_url(group.organization.slug)
            fkwargs['choices'] = []
        elif schema['type'] in ['timetracking']:
            # TODO: Implement timetracking (currently unsupported alltogether)
            return None
        elif schema.get('items') in ['worklog', 'attachment']:
            # TODO: Implement worklogs and attachments someday
            return None
        elif schema['type'] == 'array' and schema['items'] != 'string':
            fieldtype = 'select'
            fkwargs.update(
                {
                    'multiple': True,
                    'choices': self.make_choices(field_meta.get('allowedValues')),
                    'default': ''
                }
            )

        # break this out, since multiple field types could additionally
        # be configured to use a custom property instead of a default.
        if schema.get('custom'):
            if schema['custom'] == JIRA_CUSTOM_FIELD_TYPES['textarea']:
                fieldtype = 'textarea'

        fkwargs['type'] = fieldtype
        return fkwargs

    def get_issue_type_meta(self, issue_type, meta):
        issue_types = meta['issuetypes']
        issue_type_meta = None
        if issue_type:
            matching_type = [t for t in issue_types if t['id'] == issue_type]
            issue_type_meta = matching_type[0] if len(matching_type) > 0 else None

        # still no issue type? just use the first one.
        if not issue_type_meta:
            issue_type_meta = issue_types[0]

        return issue_type_meta

    def make_choices(self, x):
        return [(y['id'], y['name'] if 'name' in y else y['value']) for y in x] if x else []
