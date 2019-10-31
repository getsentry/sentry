You'll have to create an application in Asana to get a client ID and secret. Use the following for the redirect URL::

    <URL_TO_SENTRY>/account/settings/social/associate/complete/asana/

Ensure you've configured Asana auth in Sentry::

    ASANA_CLIENT_ID = 'Asana Client ID'
    ASANA_CLIENT_SECRET = 'Asana Client Secret'
