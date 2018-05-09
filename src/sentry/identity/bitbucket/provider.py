from __future__ import absolute_import

from sentry.identity.atlassian_connect import AtlassianConnectProvider, AtlassianConnectLoginView


class BitbucketIdentityProvider(AtlassianConnectProvider):
    key = 'bitbucket'
    name = 'Bitbucket'


class BitbucketLoginView(AtlassianConnectLoginView):
    def __init__(self, *args, **kwargs):
        super(AtlassianConnectLoginView, self).__init__('Bitbucket', 'bitbucket', *args, **kwargs)
