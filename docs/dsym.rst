System Debug Symbols
====================

Sentry provides support for system wide debug symbols through a separate
symbol server.  Currently you need to self host a symbol server if you
want to provide system symbols for your application.

It requires an S3 bucket where symbols are synchronized from.

Installing Symbolserver
-----------------------

The symbolserver can be found in the `getsentry/symbolserver
<https://github.com/getsentry/symbolserver>`__ git repository.  You can
find information about how to install and configure it there.

Configuration
-------------

To enable the symbolserver you need to enable the ``symbolserer.enabled``
option and provide some options to where the symbol server runs::

    symbolserver.enabled: true
    symbolserver.options:
      url: http://127.0.0.1:3000

Symbol Extraction
-----------------

The symbolserver also comes with a tool to extract system symbols on your
mac.  For more information consult the `symbolserver readme
<https://github.com/getsentry/symbolserver>`__.
