from __future__ import absolute_import

from django.http import HttpResponse

from sentry import options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView
from sentry.pipeline import PipelineView

options.register('vsts.client-id', flags=FLAG_PRIORITIZE_DISK)
options.register('vsts.client-secret', flags=FLAG_PRIORITIZE_DISK)
options.register('vsts.verification-token', flags=FLAG_PRIORITIZE_DISK)


class VSTSIdentityProvider(OAuth2Provider):
    key = 'vsts'
    name = 'VSTS'

    oauth_access_token_url = 'https://app.vssps.visualstudio.com/oauth2/token'
    oauth_authorize_url = 'https://app.vssps.visualstudio.com/oauth2/authorize'

    oauth_scopes = (
        'vso.code_full',
        'vso.identity_manage',
        'vso.work_full',
    )

    def get_oauth_client_id(self):
        return options.get('vsts.client-id')

    def get_oauth_client_secret(self):
        return options.get('vsts.client-secret')

    def get_pipeline_views(self):
        return [
            OAuth2LoginView(
                authorize_url=self.oauth_authorize_url,
                client_id=self.get_oauth_client_id(),
                scope=' '.join(self.get_oauth_scopes()),
            ),
            VSTSOAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
            ConfigView(),
        ]


class VSTSOAuth2CallbackView(OAuth2CallbackView):

    def __init__(self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs):
        super(VSTSOAuth2CallbackView, self).__init__(access_token_url, client_id, client_secret,
                                                     *args, **kwargs)

    def exchange_token(self, request, pipeline, code):
        from sentry.http import safe_urlopen, safe_urlread
        from sentry.utils.http import absolute_uri
        from six.moves.urllib.parse import parse_qsl
        from sentry.utils import json
        req = safe_urlopen(
            url=self.access_token_url,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '1322',
            },
            data={
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': self.client_secret,
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': code,
                'redirect_uri': absolute_uri(pipeline.redirect_url()),
            },
        )
        body = safe_urlread(req)
        if req.headers['Content-Type'].startswith('application/x-www-form-urlencoded'):
            return dict(parse_qsl(body))
        return json.loads(body)


class ConfigView(PipelineView):
    TEMPLATE = '''
    <form method="POST">
        Instance: <input type="text" name="instance" placeholder="example.visualstudio.com" required=True />
        <br />
        VS Team Services account ({account}.visualstudio.com) or TFS server ({server:port}).
        <br />
        Default Project: <input type="text" name="default_project" placeholder="MyProject" required=True />
        <br />
        Enter the Visual Studio Team Services project name that you wish to use as a default for new work items
        <br />
        <input type="submit" value="Submit" />
    </form>
    '''

    def dispatch(self, request, pipeline):
        if 'instance' in request.POST:
            pipeline.bind_state('instance', request.POST.get('instance'))
            if 'default_project' in request.POST:
                pipeline.bind_state('default_project', request.POST.get('default_project'))
                return pipeline.next_step()
        return HttpResponse(self.TEMPLATE)
