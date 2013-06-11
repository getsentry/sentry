Permissions
===========

As described in the plugin interface, Sentry provides a large suite of permissions which all fire through the
``has_perm`` extension point.

In most cases, a superuser (that is, if User.is_superuser is ``True``), will be granted implicit permissions
on everything. Additionally, several cases provide overrides via Django's standard permission system. All
permissions are also bound to some level of inherent permission logic, such as projects only being editable
by someone who has some level of control on that project.

This page attempts to describe those permissions, and the contextual objects along with them.

.. data:: add_project

         Controls whether a user can create a new project.

         ::

            >>> has_perm('add_project', user)

.. data:: edit_project

         Controls whether a user can edit an existing project.

         ::

            >>> has_perm('edit_project', user, project)

.. data:: remove_project

         Controls whether a user can remove an existing project.

         ::

            >>> has_perm('remove_project', user, project)

.. data:: add_project_member

         Controls whether a user can add a new member to a project.

         ::

            >>> has_perm('add_project_member', user, project)

.. data:: edit_project_member

         Controls whether a user can edit an existing member on a project.

         ::

            >>> has_perm('edit_project_member', user, member)

.. data:: remove_project_member

         Controls whether a user can remove an existing member on a project.

         ::

            >>> has_perm('remove_project_member', user, member)


.. data:: create_event

         Controls whether a user can create an event on a project (via the API).

         ::

            >>> has_perm('create_event', user, project)