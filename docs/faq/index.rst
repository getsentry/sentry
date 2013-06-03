Frequently Asked Questions
==========================

Common Problems
---------------

My sentry is running at **example.com:9000** but whenever I visit it I get redirected to **example.com**
  You likely have not correctly configured **SENTRY_URL_PREFIX**. See
  :doc:`../config/index` for more information.

AJAX requests do not seem to work properly
  It's likely you have not correctly configured **SENTRY_URL_PREFIX**, so
  you're hitting CORS issues. . See :doc:`../config/index` for more information.

How do I
--------

... script the Sentry installation to bootstrap things like projects and users?
  Sentry is a simple Django (Python) application that runs using a utility
  runner. A script that creates a project and default user might look something
  like this:

  .. code-block:: python

     # Bootstrap the Sentry environment
     from sentry.utils.runner import configure
     configure()

     # Do something crazy
     from sentry.models import Team, Project, User

     user = User()
     user.username = 'admin'
     user.email = 'admin@localhost'
     user.is_superuser = True
     user.set_password('admin')
     user.save()

     team = Team()
     team.name = 'Sentry'
     team.owner = user
     team.save()

     project = Project()
     project.team = team
     project.owner = user
     project.name = 'Default'
     project.save()

     key = ProjectKey.objects.filter(project=project)[0]
     print 'SENTRY_DSN = "%s"' % (key.get_dsn(),)
