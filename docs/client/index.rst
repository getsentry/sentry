Available Clients
=================

The following clients are officially recognized as production-ready, and support the current Sentry
protocol:

* Python (`raven-python <http://github.com/dcramer/raven>`_)
* PHP (`raven-php <http://github.com/getsentry/raven-php>`_)
* Java (`raven-java <https://github.com/kencochrane/raven-java>`_)
* Node.js (`raven-node <https://github.com/mattrobenolt/raven-node>`_)

Additionally, the following experimental clients are availabe:

* JavaScript (`raven-js <https://github.com/lincolnloop/raven-js>`_)
* CFML (`raven-cfml` <https://github.com/jmacul2/raven-cfml>`_)

Client Criteria
---------------

To become a recognized client, a library is expected to meet several criteria:

* It must fully implement the current version of the Sentry protocol.

* It must conform to the standard DSN configuration method.

* It must contain an acceptable level of documentation and tests.

* The client must be properly packaged, and named raven-<language>.
