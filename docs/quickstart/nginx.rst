Configuring Sentry with Nginx
=============================


Nginx provides a very powerful platform for running in front of Sentry as it
gives us features like rate limiting.

Below is a sample configuration for Nginx which includes (reasonable) rate
limits:

::

    http {
      # we limit both on IP (single machine) as well as project ID
      limit_req_zone  $binary_remote_addr  zone=one:10m   rate=3r/s;
      limit_req_zone  $projectid  zone=two:10m   rate=3r/s;

      # limit_req_status requires nginx 1.3.15 or newer
      limit_req_status 429;

      server {
        listen   80;

        proxy_set_header   Host                 $host;
        proxy_set_header   X-Real-IP            $remote_addr;
        proxy_set_header   X-Forwarded-For      $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto    $scheme;
        proxy_redirect     off;

        location / {
          proxy_pass        http://localhost:9000;
        }

        location ~* /api/(?P<projectid>\d+/)?store/ {
          proxy_pass        http://localhost:9000;

          limit_req   zone=one  burst=3  nodelay;
          limit_req   zone=two  burst=10  nodelay;
        }

      }
    }


Proxying uWSGI
~~~~~~~~~~~~~~

You may optionally want to setup `uWSGI <http://projects.unbit.it/uwsgi/>`_ to
run Sentry (rather than relying on the built-in gunicorn webserver).

Within your uWSGI configuration, you'll need to export your configuration path
as well the ``sentry.wsgi`` module:

::

    [uwsgi]
    env = SENTRY_CONF=/etc/sentry.conf
    module = sentry.wsgi

    ; spawn the master and 4 processes
    http-socket = :9000
    master = true
    processes = 4
