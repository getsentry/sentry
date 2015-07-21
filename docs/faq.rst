Frequently Asked Questions
==========================

Common Problems
---------------

My sentry is running at **example.com:9000** but whenever I visit it I get
redirected to **example.com**.

    You likely have not correctly configured **SENTRY_URL_PREFIX**. See
    :doc:`config` for more information.

AJAX requests do not seem to work properly.

    It's likely you have not correctly configured **SENTRY_URL_PREFIX**, so
    you're hitting CORS issues. . See :doc:`config` for more information.

The client reports success (200 OK) but I don't see events

    Something is misconfigured. A 200 OK from the API means "I have
    validated and enqueued this event", so the first thing you should check
    is your workers.

Counts on events aren't increasing.

    Counts are incremented in bulk asyncrhonously utilizing the buffer and
    queue subsystems. Check your configuration on those.


How do I
--------

... script the Sentry installation to bootstrap things like projects and users?

    Sentry is a simple Django (Python) application that runs using a utility
    runner. A script that creates a project and default user might look something
    like this::

        # Bootstrap the Sentry environment
        from sentry.utils.runner import configure
        configure()

        # Do something crazy
        from sentry.models import Team, Project, ProjectKey, User, Organization

        user = User()
        user.username = 'admin'
        user.email = 'admin@localhost'
        user.is_superuser = True
        user.set_password('admin')
        user.save()

        organization = Organization()
        organization.name = 'MyOrg'
        organization.owner = user
        organization.save()

        team = Team()
        team.name = 'Sentry'
        team.organization = organization
        team.owner = user
        team.save()

        project = Project()
        project.team = team
        project.name = 'Default'
        project.organization = organization
        project.save()

        key = ProjectKey.objects.filter(project=project)[0]
        print 'SENTRY_DSN = "%s"' % (key.get_dsn(),)
