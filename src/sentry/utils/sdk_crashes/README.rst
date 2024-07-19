SDK Crash Detection
-------


Background
=======

As an APM company, the reliability of our SDKs is one of our most essential quality goals. If our SDK breaks the customer, we fail.
Our SDK philosophy refers to this as `degrade gracefully <https://develop.sentry.dev/sdk/philosophy/#degrade-gracefully>`_.

For some SDKs, like mobile SDKs, we primarily rely on users to report SDK crashes because we don't operate them in production. If users
don't report them, we are unaware. Instead, we should detect crashes caused by our SDKs when they happen so we can proactively fix them.

The SDK crash detection doesn't seek to detect severe bugs, such as the transport layer breaking or the SDK continuously crashing. CI or
other quality mechanisms should find such severe bugs. Furthermore, the solution only targets SDKs maintained by us, Sentry.

In the beginning, this solution only works for the Cocoa SDK crashes. We will roll out this feature to more SDKs in the future.


Solution
=======

The SDK crash detection hooks into post-processing and checks the stacktraces of every event.

https://github.com/getsentry/sentry/blob/4040cb3c5b6bc8089c089b61b069dcc68de75fea/src/sentry/tasks/post_process.py#L1063-L1086

If the event is fatal, caused by one of our SDKs,
the code strips away most of the data based on an allow list and stores the event to a dedicated Sentry project. The event_stripper only keeps
SDK and system library frames. For grouping to work correctly, the event_stripper sets in_app to true for all SDK frames, but the grouping
config will change it to in_app false for all Cocoa SDK frames. To not change the grouping logic, we add the following stacktrace rule
``stack.abs_path:Sentry.framework +app +group`` to the configured in project with the id configured in the option ``issues.sdk_crash_detection.cocoa.project_id``.

You can turn the feature on or off in https://sentry.io/_admin/options. The option name is ``issues.sdk-crash-detection`` and the feature name is ``organizations:sdk-crash-detection``.
Furthermore, you can change the project to store the crash events and the sample rate per SDK with the options ``issues.sdk_crash_detection.cocoa.project_id`` and ``issues.sdk_crash_detection.cocoa.sample_rate``.
