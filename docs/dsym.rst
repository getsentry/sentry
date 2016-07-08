DSym Management
===============

Sentry is currently in the process of receiving DSym support (beginning
with iOS, tvOS, and macOS).  For some of these platforms it can become
necessary to ingest system symbol information to receive good stacktraces.
This process is currently quite involved due to the nature of the apple
platform.

This here is meant as a general guide to how system symbols are processed
and how you can extract and add symbols from Apple SDKs.

Apple Symbol Extraction
-----------------------

Apple does not provide system symbols for download. In fact the symbols
are actually contained on running i-devices.  While it is impossible for
the device itself to access that data, Xcode will extract the symbols from
a device internal cache and re-assemble dsym files from it.  We can then
take those re-assembled dsym files and extract the symbols from it.

Sentry uses a library for this called `symsynd
<https://github.com/getsentry/symsynd>`__ which provides a script named
`extract-all.py` which can process these files.

To extract and process symbols do this:

1.  connect an i-device (like an iPod) running the version of the
    operating system you want to extract the symbols of.
2.  launch Xcode and the device manager there.  It might be necesssary to
    "use this device or development".
3.  wait for Xcode to finish processing the device.
4.  go to `~/Library/Developer/Xcode/iOS DeviceSupport` (or tvOS etc.)
5.  ensure a folder there was created for the version of iOS you are
    running.
6.  run `extract-all.py`::

    $ python extract-all.py --sdk iOS "~/Library/Developers/Xcode/iOS DeviceSupport/X.Y.Z (XXXXX)"

This will create a zipfile named ``X.Y.Z (XXXXX).zip`` in your current
folder with extracted and preprocessed files.  If you are extracting for
tvOS you need to provide `tvOS` as SDK.

Import Symbols
--------------

Symbols can be imported from processed zip files with the help of the
``sentry`` command line utility::

    sentry dsym import-system-symbols /path/to/*.zip

By default symbols are imported untrimmed but if you want to save some
space you can run it with `--trim-symbols`.
