from __future__ import absolute_import

from sentry.identity.atlassian_connect import AtlassianConnectProvider, AtlassianConnectLoginView


class BitBucketIdentityProvider(AtlassianConnectProvider):
    key = 'bitbucket'
    name = 'BitBucket'


class BitBucketLoginView(AtlassianConnectLoginView):
    def __init__(self, *args, **kwargs):
        super(AtlassianConnectLoginView, self).__init__('BitBucket', 'bitbucket', *args, **kwargs)
