**Note**: This plugin has been deprecated in favor of the `GitHub Global Integration <https://docs.sentry.io/server/integrations/github/>`_.

You'll have to create an application in GitHub to get the app ID and API secret. Use the following for the Authentication redirect URL::

    <URL_TO_SENTRY>/account/settings/social/associate/complete/github/

Ensure you've configured GitHub auth in Sentry::

    GITHUB_APP_ID = 'GitHub Application Client ID'
    GITHUB_API_SECRET = 'GitHub Application Client Secret'
    GITHUB_EXTENDED_PERMISSIONS = ['repo']

If the callback URL you've registered with GitHub uses HTTPS, you'll need this in your config::

    SOCIAL_AUTH_REDIRECT_IS_HTTPS = True

If your server is behind a reverse proxy, you'll need to enable the X-Forwarded-Proto
and X-Forwarded-Host headers, and use this config::

    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True


Associate your account with GitHub (if you haven't already) via Account -> Identities. If you had
already associated your account, and you hadn't configured extended permissions, you'll need to
disconnect and reconnect the account.

You'll now see a new action on groups which allows quick creation of GitHub issues.


Caveats
~~~~~~~

If you have multiple GitHub identities associated in Sentry, the plugin will just select
one to use.
