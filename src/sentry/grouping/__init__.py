"""
sentry.grouping
~~~~~~~~~~~~~~~

This package implements various grouping related functionality in Sentry.
It's an evolution of an earlier grouping system and the backwards compatibility
with that grouping system has created a certain amount of complexity.

General Overview
----------------

Events are grouped together into issues by calculating hashes.  When a hash
is already associated with a group that group is reused.  The grouping code
can however generate more than one hash the sum of which will be added to a
group.  In the database this is represented in the `GroupHash` model.

Grouping hashes can be created from different methods.  These are called
variants and are implemented in in `sentry.grouping.variants`.  The
`get_grouping_variants_for_event` function of the grouping API evaluates all
variants that would be available for the event and returns them.

Afterward each variant can produce hashes which are then used for grouping.
Some variants (like the component variants) will use the component system
to annotate the inputs into the hashing function so that they can be shown
to the user.  These values are not persisted, but the configuration inputs are
stored in the event.

For reproducibility an event config is persisted in the event dictionary
consisting of two main sources of configuration: event enhancers and the
version of the grouping config.  Enhancers are custom rules applied to the
default grouping algorithm (specifically the stacktrace) and the base version
picks one of the many versions of the algorithm.

The default version of the algorithm is selected on a per project basis.

Variants
--------

`ChecksumVariant`:
    This is the legacy variant of the grouping algorithm.  Clients at one point
    in the past were able to provide a grouping hash (the checksum) which was
    used for grouping exclusively.

`FallbackVariant`:
    This variant produces always the same hash.  It's used if nothing else works.

`ComponentVariant`:
    This is the main variant which uses the underlying component based grouping
    strategy system.  It produces hashes but can also expose the component
    tree with annotations so users can debug it.

`CustomFingerprintVariant`:
    This variant is similar to the checksum variant but instead produces
    fingerprint values which are then hashed.  This can be used both for
    events produced by the server as well as events which are fingerprinted
    by the SDK.  If the special `{{ default }}` value is used then this
    variant is not used.

`SaltedComponentVariant`:
    This variant is used when the server or client produce a fingerprint
    that refers with the special `{{ default }}` value to the default
    grouping algorithm and the default grouping algorithm uses the
    component based grouping system.

Component Based Grouping
------------------------

The component based grouping system produces a tree of nodes (referred to
as component) to produce the hash.  These are defined in
`sentry.grouping.component`.  A component has an `id` which is a string
identifying the component in the tree.  This `id` is not unique in the tree
but unique on one level of the hierarchy.  It has an optional `hint` which is
a string that carries information for the user about why a value was used, not
used or why it might have been modified.  Additionally it can carry `values`
which are either components or primitives (strings or integers).  Lastly a
component has a boolean `contributes` flag.  When set to `False` this flag
removes a component (and its children) entirely from the grouping output.

Here an example of how components can be used::

    function_name = 'lambda$1234'
    threads = GroupingComponent(
        id="function",
        values=[function_name],
        contributes=False,
        hint='Unused because generated code'
    )

Strategies and Strategy Configurations
--------------------------------------

Component based grouping is triggered by strategies.  Strategies define the
logic for how to generate a component for an interface in the event.  Each
strategy can only produce a component for one interface.  For instance a
stacktrace strategy can produce a component tree for a stacktrace.  Because
events can have different forms and different strategies for the same interface
strategy configurations define which ones are picked.

So for instance there is a `frame:legacy` strategy which is the legacy
version of `frame` strategy.  Then there are the new ones (`frame:v1`,
`frame:v2`, etc.).  The strategy configuration defines which one is used.
These are in `sentry.grouping.strategies.configurations`.  A strategy can
inherit from another one in which case a lot of behavior is inherited unless
overridden.

This for instance is how one of the configurations is defined::

    register_strategy_config(
        id="newstyle:2019-10-29",
        base="newstyle:2019-05-08",
        delegates=["frame:v4"],
        risk=RISK_LEVEL_MEDIUM,
        changelog="...",
    )

The configuration ID (`newstyle:2019-10-29`) is defined in the project
options and then becomes the strategy configuration of choice for all new
events.  Because in this case it inherits from another one, the default
configurations from that strategy are reused.  Here the `frame` is changed
to version `v4`.  Additionally a risk level and changelog is defined which
the UI uses to guide the user through upgrades.

Note that here the frame is defined as a delegate.  A delegate is a strategy
that is used for an interface which by itself is not used for grouping.  This
means that just because an event has a frame, the frame strategy does not
activate.  Only if another interface recurses down into a frame this strategy
will be used.

To add a new configuration just add it to the list.  To make a configuration the default
for new projects you also need to bump the project epoch and configure it
to be used by default for an epoch in `sentry.projectoptions.defaults`
(for the `sentry:grouping_config`) key.

Fingerprinting and Enhancements
-------------------------------

Server side fingerprinting and enhancements are also folded into this grouping
system.  The former is in `sentry.grouping.fingerprinting` and can fundamentally
override the default grouping system.  Enhancements are used by the stacktrace
strategies to improve how stacktraces are used for grouping.  Enhancements
activate in two places: as part of stacktrace normalization to update the
`in-app` flag and later on grouping by the stacktrace strategy to add or remove
frames from the grouping algorithm.

Testing
-------

Tests for grouping are in `tests/sentry/grouping`.  They are snapshot based
and snapshots exist for all tests and all versions of the grouping algorithm.
If you add a new one copy the folder in the snapshot directory over to match
the new name which makes it easier to evaluate differences.
"""
