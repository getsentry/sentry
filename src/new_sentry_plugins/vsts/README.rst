**Note**: This plugin has been deprecated in favor of the `Azure DevOps Global Integration<https://docs.sentry.io/workflow/integrations/global-integrations/#azure-devops>`_.

You'll have to `create an application in Visual Studio <https://app.vsaex.visualstudio.com/app/register>`_ to get a client ID and secret.

**Redirect URL:**

::

    <URL_TO_SENTRY>/account/settings/social/associate/complete/visualstudio/


**Scopes:**

- Code (read) -- ``vso.code``
- Work items (read and write) -- ``vso.work_write``
- Project and Team (read) -- ``vso.project``
- Releases (read) -- ``vso.release``

Add the configured application credentials to your Sentry config:

.. code-block:: python

    VISUALSTUDIO_APP_ID = 'App ID'
    VISUALSTUDIO_APP_SECRET = 'App Secret'
    VISUALSTUDIO_CLIENT_SECRET = 'Client Secret'
    VISUALSTUDIO_SCOPES = ['vso.project', 'vso.work_write', 'vso.code', 'vso.release']
