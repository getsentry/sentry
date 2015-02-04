----
title:Data Sampling
----

Due to the large amount of data Sentry collects, it becomes impractical to store all data about every event. Instead, Sentry stores a single entity for every unique event (a group, as we call it), and will then only store a subset of the repeat events. We attempt to do this in an intelligent manner so that it becomes almost invisible to you.

For example, when a new event comes in, it creates an aggregate. Several of the following events will also create individual entries under that aggregate. Once it we see a certain threshhold reached of the same event, we stop storing every entry, and instead store one in N events, as well as one event every N seconds. Additionally, we will always store the first event on a status change (e.g. you resolve an event and it happens again).
