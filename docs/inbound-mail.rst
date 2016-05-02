Inbound Mail
============

Sentry provides support for handling incoming email in various situations.
Currently it only supports processing replies to error and note
notifications.

For configuration you can pick from different backends.


Inbound Email via Mailgun
-------------------------

.. versionadded:: 7.2.0

Start by choosing a domain to handle inbound email. We find it easiest if
you maintain a separate domain from anything else. In our example, we're
going to choose ``inbound.sentry.example.com``. You'll need to configure
your DNS records for the given domain according to the Mailgun
documentation.

Create a new route in mailgun::

    Priority:
      0
    Filter Expression:
      catch_all()
    Actions:
      forward("https://sentry.example.com/api/hooks/mailgun/inbound/")
    Description:
      Sentry inbound handler

Configure Sentry with the appropriate settings:

.. code-block:: yaml

    # Your Mailgun API key (used to verify incoming webhooks)
    mail.mailgun-api-key: ''

    # Set the SMTP hostname to your configured inbound domain
    mail.reply-hostname: 'inbound.sentry.example.com'

    # Inform Sentry to send the appropriate mail headers to enable
    # incoming replies
    mail.enable-replies: true


That's it! You'll now be able to respond to activity notifications on
errors via your email client.


.. _nginx-mail:

Inbound Email via Nginx
-----------------------

Start by choosing a domain to handle inbound email. We find it easiest if
you maintain a separate domain from anything else. In our example, we're
going to choose ``inbound.sentry.example.com``. You'll need to configure
your DNS records appropriately.

Add another supervisor config to run the Sentry ``smtp`` service::

    [program:sentry-inbound-mail]
    directory=/www/sentry/
    command=/www/sentry/bin/sentry run smtp
    autostart=true
    autorestart=true
    stdout_logfile syslog
    stderr_logfile syslog

Configure an Nginx route as an SMTP mail proxy::

    http {
      # Bind an http server to localhost only just for the smtp auth
      server {
        listen 127.0.0.1:80;

        # Return back the address and port for the listening
        # Sentry smtp server. Default is 127.0.0.1:1025.
        location = /smtp {
          add_header Auth-Server 127.0.0.1;
          add_header Auth-Port   1025;
          return 200;
        }
      }
    }

    mail {
      auth_http localhost/smtp;

      server {
        listen 25;

        protocol   smtp;
        proxy      on;
        smtp_auth  none;
        xclient    off;
      }
    }


And finally, update Sentry with the appropriate settings:

.. code-block:: yaml

    # Set the SMTP hostname to your configured inbound domain
    mail.reply-hostname: 'inbound.sentry.example.com'

    # Inform Sentry to send the appropriate mail headers to enable
    # incoming replies
    mail.enable-replies: true

That's it! You'll now be able to respond to activity notifications on
errors via your email client.
