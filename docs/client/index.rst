Available Clients
=================

The following clients are officially recognized as production-ready, and support the current Sentry
protocol:

- Python (`raven-python <http://github.com/getsentry/raven-python>`_)
- PHP (`raven-php <http://github.com/getsentry/raven-php>`_)
- Java (`raven-java <https://github.com/kencochrane/raven-java>`_)
- Ruby (`raven-ruby <https://github.com/getsentry/raven-ruby>`_)
  - Chef (`chef-sentry-handler <https://github.com/coderanger/chef-sentry-handler>`_)
- JavaScript (`raven-js <https://github.com/getsentry/raven-js>`_)
- Node.js (`raven-node <https://github.com/mattrobenolt/raven-node>`_)
- iOS / Objective-C (`raven-objc <https://github.com/getsentry/raven-objc>`_)
- C# (`raven-csharp <https://github.com/getsentry/raven-csharp>`_)

Additionally, the following experimental clients are available:

- Action Script 3 (`raven-as3 <https://github.com/skitoo/raven-as3>`_)
- CFML (`raven-cfml <https://github.com/jmacul2/raven-cfml>`_)
- Erlang (`raven-erlang <https://github.com/soundrop/raven-erlang>`_)
- R (`logging <http://logging.r-forge.r-project.org/>`_)
- Server-Side ActionScript (`raven-ssas <https://github.com/seegno/raven-ssas>`_)

Client Criteria
---------------

If you're developing a client for your platform, there's several things we highly encourage:

* It should fully implement the current version of the Sentry protocol.

* It should conform to the standard DSN configuration method.

* It should contain an acceptable level of documentation and tests.

* The client should be properly packaged, and named raven-<platform>.
