Install
=======

Sentry requires at least Django 1.2 (it will generally take care of this by itself),
and Python 2.5. Currently Sentry does not work with Python 3.

If you haven't already, start by downloading Sentry. The easiest way is with *pip*::

	pip install sentry --upgrade

Or with *setuptools*::

	easy_install -U sentry

You now have two choices:

1. **(Recommended)** Run the server in a separate web instance to isolate your application.

   The recommended setup for apps which have any kind of quality of service requirements.
   Your Sentry server (web) application will run in its own environment which ensures the
   most compatibility with your application, as well as ensuring it does not impact your
   primary application servers.

2. Run an integrated setup where your webapp runs both the Sentry client and server.

   If you run on a single web server, or don't expect high load, this is the quickest
   configuration to get up and running.

Upgrading
---------

**Always upgrade the Sentry server before upgrading your clients** unless
the client states otherwise.

Upgrading Sentry simply requires you to run migrations and restart your web services. We recommend
you run the migrations from a separate install so that they can be completed before updating the
code which runs the webserver.

To run the migrations, simply run ``sentry upgrade`` in your environment.

Upgrading from 1.x
~~~~~~~~~~~~~~~~~~

If you are upgrading Sentry from a 1.x version, you should take note that the database migrations
are much more significant than they were in the past. We recommend performing them **before**
upgrading the actual Sentry server.

This includes several new tables (such as Project), and alters on almost all existing tables. It
also means it needs to backfill the project_id column on all related tables.

You should also read over the installation guide again, as some things have likely changed.

Running a Sentry Server
-----------------------

The recommended configuration of Sentry involves setting up a separate web server to handle your error
logging. This means that any number of Sentry clients simply pass on this information to your primary Sentry
server. If you run into a situation where one of Sentry's requirements conflict with your own, or you simply
need to ensure quality of service within your project, this is for you.

.. note:: Currently the standalone Sentry server does not run on Windows.

Initializing the Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The first thing you're going to need to do is initialize your configuration (likely because you'll want to switch
off of sqlite, which is the default database).

To do this, you'll use the "init" command. You can specify an alternative configuration
path as the argument to init, otherwise it will use the default of ``~/.sentry/sentry.conf.py``.

::

    # the path is optional
    sentry init /etc/sentry.conf.py

Running migrations
~~~~~~~~~~~~~~~~~~

Schema changes are handled via the ``upgrade`` command::

    sentry upgrade

The Built-in Server
~~~~~~~~~~~~~~~~~~~

Sentry provides a built-in webserver (powered by eventlet) to get you off the ground quickly.

The CLI runner has three commands for controlling processes: start, stop, and restart. For example,
to start the HTTP server, you can simply use "sentry start"::

	# Sentry's server runs on port 9000 by default. Make sure your ``SENTRY_SERVERS`` settings reflects
	# the correct host and port!
	sentry start --config=/etc/sentry.conf.py

The configuration for the server is based on ``sentry.conf.server``, which contains a basic Django project configuration, as well
as the default Sentry configuration values. It will use SQLite for the database.::

    # ~/.sentry/sentry.conf.py

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': '',
            'HOST': '',
            'PORT': '',
        }
    }

    SENTRY_LOG_FILE = '/var/log/sentry.log'
    SENTRY_WEB_HOST = '0.0.0.0'
    SENTRY_WEB_PORT = 9000
    SENTRY_KEY = '0123456789abcde'

By default, Sentry will look for ``~/.sentry/sentry.conf.py`` and load it if it exists, and ``--config`` is not passed. You
may also set the ``SENTRY_CONFIG`` environment variable to override the default value of --config.

Configuring a Proxy
~~~~~~~~~~~~~~~~~~~

By default, Sentry runs on port 9000. Even if you change this, under normal conditions you won't be able to bind to
port 80. To get around this (and to avoid running Sentry as a privileged user, which you shouldn't), we recommend
you setup a simple web proxy.

Proxying with Apache
````````````````````

Apache requires the use of mod_proxy for forwarding requests::

    ProxyPass / http://localhost:9000/
    ProxyPassReverse / http://localhost:9000/

Proxying with Nginx
```````````````````

You'll use the builtin HttpProxyModule within Nginx to handle proxying::

    location / {
      proxy_pass         http://localhost:9000;
      proxy_redirect     off;

      proxy_set_header   Host             $host;
      proxy_set_header   X-Real-IP        $remote_addr;
      proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    }

Running Sentry on DotCloud.com
------------------------------

If you would like to run Sentry on `DotCloud.com <http://DotCloud.com>`_, you will need to run Sentry in integrated mode instead of using the built in Sentry server. Doing this requires that you have a normal django project with all of the settings configured correctly. 

The following steps will guide you through the process of setting up Sentry on DotCloud using a django project that is already created and lives on github.com. This should make deploying your Sentry server to DotCloud fairly straightforward.

1. Create a place on your local computer to store your new project::

    $ mkdir -p ~/projects

2. Go into the new projects directory::

    $ cd ~/projects

3. Clone the sentry-on-dotcloud git repo from github, (requires `git <http://git-scm.com>`_ client)::

    $ git clone git://github.com/kencochrane/sentry-on-dotcloud.git

4. Go into the new sentry-on-dotcloud project directory::

    $ cd sentry-on-dotcloud

5. Create a new virtualenv (using `virtualenvwrapper <http://www.doughellmann.com/projects/virtualenvwrapper/>`_, `virtualenv <http://pypi.python.org/pypi/virtualenv>`_, and `pip <http://www.pip-installer.org/>`_)::

    $ mkvirtualenv --no-site-packages --distribute sentry-on-dotcloud

6. Install all of the Sentry requirements via pip and the ``requirements.txt`` file::

    $ pip install -r requirements.txt

7. Installing the DotCloud client  http://docs.dotcloud.com/firststeps/install/ (here are the steps for Linux and Mac OSX)::

    $ sudo pip install -U dotcloud

8. Sign up for a DotCloud account https://www.dotcloud.com/accounts/register/ if you haven't already.

9. The first time you use the DotCloud account you will need to add your api key. So type dotcloud and follow the steps. You can find your API key at http://www.dotcloud.com/account/settings::

    $ dotcloud

10. Create your new Sentry application on DotCloud::

    $ dotcloud create sentry

11. Open up the following files and change the ``SENTRY_KEY`` settings, to the same unique value.

    - sentry_conf.py
    - sentryproj/settings.py
    
Here is an example on how to generate a good unique key that you can use in the files above::

    >>> import base64
    >>> import os
    >>> KEY_LENGTH = 40
    >>> base64.b64encode(os.urandom(KEY_LENGTH))
    '6+tSEh1qYwDuTaaQRcxUjMDkvlj4z9BU/caCFV5QKtvnH7ZF3i0knA=='

12. Add your email address to ``SENTRY_ADMINS`` in sentryproj/settings.py . This will send you emails when an error occurs.::

     SENTRY_ADMINS = ('youremail@example.com',)

13. Push your code into DotCloud::

     $ dotcloud push sentry .

14. Find out the url for your application::

     $ dotcloud url sentry

15. Open the url from step 14 in your browser and start using sentry on DotCloud.

16. Open up the django admin and change the admin password from the default one that was created on deployment.

17. Test out sentry using the raven client to make sure it is working as it should. Open up a python shell on your local machine and do the following. 

Replace the ``server_url`` with your sentry url you found out in step 14. Make sure it ends in /store/ . Also make sure you replace ``my_key`` with your sentry key::

    >>> from raven import Client
    >>> server_url = "http://sentry-username.dotcloud.com/store/"
    >>> my_key='1234-CHANGEME-WITH-YOUR-OWN-KEY-567890'
    >>> client = Client(servers=[server_url], key=my_key)
    >>> client.create_from_text('My event just happened!')
    ('48ba88039e0f425399118f82173682dd', '3313fc5636650cccaee55dfc2f2ee7dd')

If you go to the sentry webpage you should see your test message. If not, double check everything, and see if there was any errors during the send.

Once this is all up and running you can install the raven client in your applications, and start sending your logs to sentry.

17. Optional: If you don't like the URL they gave you, you can use your custom domain. Assuming your application was ``sentry.www`` and your domain was ``www.example.com`` you would do the following::

     $ dotcloud alias add sentry.www www.example.com

18. Once you get everything working, change your django DEBUG setting to False in ``sentryproj/settings.py``.
