from __future__ import absolute_import

from social.strategies.django_strategy import DjangoStrategy


class DSAStrategy(DjangoStrategy):
    settings_map = {
        'BITBUCKET_KEY': 'BITBUCKET_CONSUMER_KEY',
        'BITBUCKET_SECRET': 'BITBUCKET_CONSUMER_SECRET',
        'GITHUB_SECRET': 'GITHUB_API_SECRET',
        'GITHUB_KEY': 'GITHUB_APP_ID',
        'GITHUB_SCOPE': 'GITHUB_EXTENDED_PERMISSIONS',
        'GOOGLE_OAUTH_KEY': 'GOOGLE_CONSUMER_KEY',
        'GOOGLE_OAUTH_SECRET': 'GOOGLE_CONSUMER_SECRET',
        'GOOGLE_OAUTH_SCOPE': 'GOOGLE_OAUTH_EXTRA_SCOPE',
        'GOOGLE_OAUTH2_KEY': 'GOOGLE_OAUTH2_CLIENT_KEY',
        'GOOGLE_OAUTH2_SECRET': 'GOOGLE_OAUTH2_CLIENT_SECRET',
        'GOOGLE_OAUTH2_SCOPE': 'GOOGLE_OAUTH_EXTRA_SCOPE',
        'TRELLO_KEY': 'TRELLO_CONSUMER_KEY',
        'TRELLO_SECRET': 'TRELLO_CONSUMER_SECRET',
        'ON_HTTPS': 'SOCIAL_AUTH_REDIRECT_IS_HTTPS',
    }

    def get_setting(self, name):
        if name in self.settings_map:
            # Try DSA setting name from map defined above
            try:
                return super(DSAStrategy, self).get_setting(
                    self.settings_map[name]
                )
            except (AttributeError, KeyError):
                pass
        # Fallback to PSA setting name
        return super(DSAStrategy, self).get_setting(name)

    def get_pipeline(self):
        pipeline = super(DSAStrategy, self).get_pipeline()
        pipeline_renamed = []
        for entry in pipeline:
            if entry.startswith('social_auth.backends.pipeline.social'):
                entry = entry.replace(
                    'social_auth.backends.pipeline.social',
                    'social_auth.backends.pipeline.sauth'
                )
            pipeline_renamed.append(entry)
        return pipeline_renamed
