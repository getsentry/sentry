Node Storage
------------
This component powers Sentry's `Node Storage <https://docs.sentry.io/server/nodestore/>`_.
The Node Storage is a multiple-backend-compatible engine that is tasked with storing the
raw body of an Event.

Purpose
=======
Events have the ability to be multiple megabytes in size. Traditional relational databases
like PostgreSQL and MySQL have a very hard time dealing with wide individual rows during
normal CRUD operations.

Node Storage removes the size problem from these databases and stores the content in
a traditional key/value database, which is more suitable for the size of Event.

Owners
======
@getsentry/platform

Dependencies
============

=========== =================================
Component   Interaction
----------- ---------------------------------
None
=========== =================================

Design
======
Sentry's Node Storage implementation follows the same structure as other
multiple-backend-compatible components, defining a base and an implementation
for the supported service. The default implementation stores the data inside the same
database alongside the other Event data. This should be seen as an effort to reduce the
starting barrier to run Sentry, and is not recommended for production systems.

Any backend may be written to fit the Node Storage design, as long as this backend supports
regular set, get, and delete operations.

Node Data is directly controlled by the Django ORM, via the
`Node custom field <https://github.com/getsentry/sentry/blob/master/src/sentry/db/models/fields/node.py>`_.

Interaction
===========

Getting Node Data
`````````````````
While Node Storage does not depend on any other component, it is rarely called directly.
Events are bound to their node data by calling
``eventstore.bind_nodes(event_list, 'data')``. The reason that we supply the ``bind_nodes``
with a list is to utilize any backend that may support a "multiget" command, which heavily
reduces the round trip time that it takes to receive data for multiple nodes.

Setting Node Data
`````````````````
The Node custom field is responsible for storing data when ``save()`` is called on an Event.
A developer need not worry about directly setting data via ``nodestore`` methods.

Deleting Node Data
``````````````````

Node data is deleted as part of ``sentry.tasks.deletion``. The
deletion process of node data is different from other Node Storage operations because it is
entirely optional for a backend to actually delete the data. This concept can be leveraged by
backends that support time-to-live(TTL) fields, taking the responsibility of deleting data
away from Sentry.

Developmental Cycle
===================
Since Node Storage has been implemented in multiple backends, it is highly recommended to author
your code changes against both the default backend and the backend your use in your production
environment.

Testing
=======
It may be expensive to run your backend implementation during the normal testing suite, Sentry
has implemented the concept of "skips". Tests will be ran against your backend implementation
only if the service your backend uses is available. This utility can be found in
`sentry.testutils.skips <https://github.com/getsentry/sentry/blob/master/src/sentry/testutils/skips.py>`_.
