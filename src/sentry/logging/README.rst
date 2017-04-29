Logging
-------
This component houses sentry's logging handler and utilities.
The handler allows sentry to collect a context dictionary along with log events.

Purpose
=======
Natural language log events are great for people who are reading along, but in a
systematic logging infrastructure, articles and spaces are useless. String interpolation
is also helpful for humans, but passing a context dictionary along allows humans to
read it if they want, and allows modern log capture technologies to leverage key-value pairs.

Owners
======
@getsentry/ops

Dependencies
============

=========== =================================
Component   Interaction
----------- ---------------------------------
None
=========== =================================

Design
======
Sentry's logging component is comprised of a few subcomponents, each with a different purpose.

Handlers
````````
Internal
~~~~~~~~
Sentry has the ability to send its own exceptions into the event processing pipeline it
provides. The ``internal`` handler is responsible for capturing events at the ``ERROR``
level and sending them through the pipeline using `Raven`.

Console
~~~~~~~
Sentry's core logging handler, ``console``, is the ``StructlogHandler`` class inside of
``sentry.logging.handlers``. It is a small wrapper around `Structlog <http://structlog.org>`_
that facilitates the transformation from ``LogRecord`` to Structlog's event dictionary.

Loggers
```````
Sentry follows the standard logging pipeline that Python provides. This means that most of
the conventional loggers that are created propagate upwards to the ``root`` logger. Loggers
are configured via the ``LOGGING`` dictionary.

Root
~~~~
The root logger is the only logger that has both primary handlers attached. All other loggers
that want to log to the primary handlers follow standard logger inheritance. The only value
that a child logger in the hierarchy should set is the ``level``.

Non-inheritors
~~~~~~~~~~~~~~
The best way to silence noisy loggers is to follow examples of non-inheritance in the current
``LOGGING`` configuration value, defined in ``sentry.conf.server``. A good example would be
the ``toronado`` logger.

Overridables
~~~~~~~~~~~~
Sentry provides the ability to override logging levels with a command-line argument or an
environment variable. The loggers that get their level re-written to the specified value
are defined in ``LOGGING.overridable``.

Formats
```````
The ``StructlogHandler`` has the ability to write its records based on a specified logging
format defined in the options by ``system.logging-format``.

Human
~~~~~
The ``human`` formatter will write log records in a standard format that is meant to put
legibility first. The format is defined as: ``timestamp [LEVEL] logger: event (key:value)``.
When if any key-value pairs are provided in the ``extra`` keyword argument, they will be
appended to the log record after then event.

Machine
~~~~~~~
The ``machine`` formatter will write log records in `JSON` format, providing a dictionary
with the standard logging key-value pairs, merging any pairs provided in the ``extra`` keyword
argument.

Interaction
===========

Getting a Logger
````````````````
Any logger can be easily instantiated by including: ``logger = logging.getLogger(__name__)``.
The ``__name__`` structure should be sufficient for most loggers, mainly excluding anything
defined in utilities.

Creating Context
````````````````
As stated prior, the ``extra`` keyword argument can be supplied with a dictionary so that
important key-value pairs can be passed along with an event. These context keys should be
identifying information that can be used to either properly search for a specific event, or
associate the event in question with similar events. A good example for context would be
the ``organization_id``.

Binding Context
```````````````
In rare cases, it is unfeasible to pass a context dictionary throughout a code path.
For this case, there is a small utility defined as ``sentry.logging.bind``. calling ``bind``
with the name of the desired logger, along with any keyword arguments, will bind said
keyword arguments to the logger with that name. For example, calling
``bind('sentry.auth', organization_id=1)`` will merge ``organization_id=1`` with whatever
context is passed in the next time the ``sentry.auth`` logger records an event.

Event Definition
````````````````
Sentry does not follow the practice of logging a natural language statement like
`"Something happened because reason."`. Instead, it logs a statement as an event. Events
are structured as ``Object.Action.Reason``, so the prior statement would become
`"something.happened.reason"`.

The justification for such a structure is that it is:

#. There is no string interpolation needed because of the context passed alongside.
#. Since the event is a static string, it is much easier to search and index.
#. Natural language tends to include unnecessary articles and punctuation.

Note: Debugging statements are more lenient on this structure because they should only be used
in either the developmental cycle or when an actual human is trying to gain insight into the
production system.

Choosing a Level
````````````````
Here is a handy little guide towards choosing a logging level for an event:

**DEBUG**

- Helps gain insight towards unexpected behavior in a specific code block.
- Reports on expected failures (Err 4XX).
- Provides rich data that is normally expensive to collect.

**INFO**

- Provides information alongside an event that is actionable (Proof for support).
- Helps gain insight towards expected behavior in the entire module.

**WARNING**

- Reports on potentially harmful or malicious situations.
- Helps gain insight towards unexpected but mitigated failures.

**ERROR**

- Helps gain insight towards unexpected and unmitigated failures.
- Should be worthy of reporting via the Sentry product pipeline.

Developmental Cycle
===================
Since the logging component is only ever used elsewhere, it is better to refer to the
developmental cycle of the relevant component.

That being said, if you are having any trouble with believing something should appear,
it is always recommended that you use ``sentry shell`` to manually instantiate a logger
that matches the name of the one you're using and inspect it for the relevant handlers
and set logging level.

Testing
=======
Since `py.test` aims to capture any stdout/err, you can tack on an extra ``assert False`` to
your test to see what the logging statements would look like when your code path is taken.
