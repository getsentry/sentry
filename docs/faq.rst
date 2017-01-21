Frequently Asked Questions
==========================

This document covers some frequently asked questions that come up.

.. class:: qa

Sentry shows *Bad Request (400)* when loading the web UI.

    Your **system.url-prefix** setting is wrong. See :doc:`config` for
    more information.

.. class:: qa

My sentry is running at **example.com:9000** but whenever I visit it I get
redirected to **example.com**.

    You likely have not correctly configured **system.url-prefix**. See
    :doc:`config` for more information.

.. class:: qa

AJAX requests do not seem to work properly.

    It's likely you have not correctly configured **system.url-prefix**, so
    you're hitting CORS issues. See :doc:`config` for more information.

.. class:: qa

The client reports success (200 OK) but I don't see events

    Something is misconfigured. A 200 OK from the API means "I have
    validated and enqueued this event", so the first thing you should check
    is your workers.

.. class:: qa

Counts on events aren't increasing.

    Counts are incremented in bulk asynchronously utilizing the buffer and
    queue subsystems. Check your configuration on those.  Also make sure
    that you have the workers and cron running.

.. class:: qa

How do I script the Sentry installation to bootstrap things like projects
and users?

    Sentry is a simple Django (Python) application that runs using a utility
    runner. A script that creates a project and default user might look something
    like this:

    .. sourcecode:: python

        # Bootstrap the Sentry environment
        from sentry.utils.runner import configure
        configure()

        # Do something crazy
        from sentry.models import (
            Team, Project, ProjectKey, User, Organization, OrganizationMember,
            OrganizationMemberTeam
        )

        organization = Organization()
        organization.name = 'MyOrg'
        organization.save()

        team = Team()
        team.name = 'Sentry'
        team.organization = organization
        team.save()

        project = Project()
        project.team = team
        project.name = 'Default'
        project.organization = organization
        project.save()

        user = User()
        user.username = 'admin'
        user.email = 'admin@localhost'
        user.is_superuser = True
        user.set_password('admin')
        user.save()

        member = OrganizationMember.objects.create(
            organization=organization,
            user=user,
            role='owner',
        )

        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team,
        )

        key = ProjectKey.objects.filter(project=project)[0]
        print 'SENTRY_DSN = "%s"' % (key.get_dsn(),)
