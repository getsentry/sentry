Inbound Email via Mailgun
=========================

.. versionadded:: 7.2.0

Start by choosing a domain to handle inbound email. We find it easiest if you maintain a separate domain from anything else. In our example, we're going to choose ``inbound.sentry.example.com``. You'll need to configure your DNS records for the given domain according to the Mailgun documentation.

Create a new route in mailgun:

::

    Priority:
      0
    Filter Expression:
      catch_all()
    Actions:
      forward("https://sentry.example.com/api/hooks/mailgun/inbound/")
    Description:
      Sentry inbound handler

Configure Sentry with the appropriate settings:

.. code-block:: python

    # Your Mailgun API key (used to verify incoming webhooks)
    MAILGUN_API_KEY = ''

    # Set the SMTP hostname to your configured inbound domain
    SENTRY_SMTP_HOSTNAME = 'inbound.sentry.example.com'

    # Inform Sentry to send the appropriate mail headers to enable
    # incoming replies
    SENTRY_ENABLE_EMAIL_REPLIES = True


That's it! You'll now be able to respond to activity notifications on errors via your email client.
