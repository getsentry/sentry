from __future__ import absolute_import


from sentry.integrations import Integration, IntegrationMetadata


metadata = IntegrationMetadata(
    description='Sync Sentry and JIRA issues. This integration must be installed from the JIRA app store.',
    author='The Sentry Team',
    issue_url='https://github.com/getsentry/sentry/issues/new?title=JIRA%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira',
    aspects={},
)


class JiraIntegration(Integration):
    key = 'jira'
    name = 'JIRA'
    metadata = metadata

    can_add = False

    def get_pipeline_views(self):
        return []
