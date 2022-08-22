**Note**: This plugin has been deprecated in favor of the `Bitbucket Global Integration <https://docs.sentry.io/product/integrations/source-code-mgmt/bitbucket/>`_.

Go to https://bitbucket.org/account/user/**YOUR_USERNAME**/api

Create OAuth consumer key and secret and then put

::

    BITBUCKET_CONSUMER_KEY = '<Key>'
    BITBUCKET_CONSUMER_SECRET = '<Secret>'


into ``sentry.conf.py``
