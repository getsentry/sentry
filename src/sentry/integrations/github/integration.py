from __future__ import absolute_import
import six
from sentry import http, options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.integrations import Integration, IntegrationMetadata
from sentry.utils.pipeline import NestedPipelineView, PipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri

options.register('github.app-name', flags=FLAG_PRIORITIZE_DISK)

DESCRIPTION = """
    Install GitHub Apps
"""


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    issue_url='',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github',
    aspects={}
)


class GitHubIntegration(Integration):
    key = 'github'
    name = 'GitHub'
    metadata = metadata

    setup_dialog_config = {
        'width': 600,
        'height': 900,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': (),
            'redirect_url': absolute_uri('/extensions/github/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='github',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [GitHubInstallationRedirect(), identity_pipeline_view]

    def get_config(self):
        return [{
            'name': 'github',
            'label': 'GitHub',
            'type': 'text',
            'metadata': metadata,
            'required': True,
        }]

    def get_installation_info(self, access_token):
        payload = {
            'access_token': access_token,
        }

        session = http.build_session()
        resp = session.get(
            'https://api.github.com/user/installations',
            params=payload,
            headers={'Accept': 'application/vnd.github.machine-man-preview+json'}
        )
        resp.raise_for_status()
        resp = resp.json()

        return resp['installations']

    def build_integration(self, state):
        data = state['identity']['data']
        installation_info = self.get_installation_info(data['access_token'])
        for installation in installation_info:
            if state['installation_id'] == six.text_type(installation['id']):
                integration = {
                    'name': installation['account']['login'],
                    'external_id': installation['id'],
                    'metadata': {
                        'access_token': data['access_token'],
                        'icon': installation['account']['avatar_url'],
                        'domain_name': installation['account']['html_url'],
                    }
                }
                if installation['account']['type'] == 'User':
                    integration['user_identity'] = {
                        'type': 'github',
                        'external_id': installation['account']['id'],
                        'scopes': [],
                        'data': {},
                    }

                return integration


class GitHubInstallationRedirect(PipelineView):
    def get_app_url(self):
        name = options.get('github.app-name')
        return 'https://github.com/apps/%s' % name

    def dispatch(self, request, pipeline):
        if 'installation_id' in request.GET:
            pipeline.bind_state('installation_id', request.GET['installation_id'])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
