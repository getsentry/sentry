----
title:Event Tagging
----

Sentry implements a system it calls tags. Tags are various key/value pairs that get assigned to an event, and can later be used as a breakdown or quick access to finding related events.

Several common uses for tags include:

- The hostname of the server
- The version of your application (e.g. your git sha)
- The version of your platform (e.g. iOS 5.0)

Once you've starting sending tagged data, you'll see it show up in a few places:

- The filters within the sidebar on the project stream page.
- Summarized within an event on the sidebar.
- The tags page on an aggregated event.

We'll automatically index all tags for an event, as well as the frequency and the last time a value has been seen. Even more so, we keep track of the number of distinct tags, and can assist in you determining hotspots for various issues.

Most clients generally support configuring tags at the global client level configuration, as well as on a per event basis.

For example, in the JavaScript client:

```
Raven.captureMessage('hello world!', {tags: {
 	version: 'my application version'
}});
```

See your client's documentation for more information on sending tag metadata with events.
