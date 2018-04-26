from __future__ import absolute_import

from sentry import http, options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.integrations import Integration, IntegrationMetadata
from sentry.utils.pipeline import NestedPipelineView, PipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri

from .utils import get_jwt

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

    def get_user_info(self, access_token):
        payload = {
            'access_token': access_token,
        }

        session = http.build_session()
        resp = session.get(
            'https://api.github.com/user',
            params=payload,
            headers={'Accept': 'application/vnd.github.machine-man-preview+json'}
        )
        resp.raise_for_status()
        resp = resp.json()

        return resp

    def get_installation_info(self, installation_id):
        session = http.build_session()
        resp = session.get(
            'https://api.github.com/app/installations/%s' % installation_id,
            headers={
                'Authorization': 'Bearer %s' % get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                'Accept': 'application/vnd.github.machine-man-preview+json',
            }
        )
        resp.raise_for_status()
        resp = resp.json()

        return resp

    def build_integration(self, state):
        data = state['identity']['data']
        user = self.get_user_info(data['access_token'])
        installation = self.get_installation_info(state['installation_id'])
        return {
            'name': installation['account']['login'],
            'external_id': installation['id'],
            'metadata': {
                'access_token': installation['access_tokens_url'],
                'icon': installation['account']['avatar_url'],
                'domain_name': 'github.com/%s' % installation['account']['login'],
            },
            'user_identity': {
                'type': 'github',
                'external_id': user['id'],
                'scopes': [],
                'data': {'access_token': data['access_token']},
            },
        }


class GitHubInstallationRedirect(PipelineView):
    def get_app_url(self):
        name = options.get('github.app-name')
        return 'https://github.com/apps/%s' % name

    def dispatch(self, request, pipeline):
        if 'installation_id' in request.GET:
            pipeline.bind_state('installation_id', request.GET['installation_id'])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
