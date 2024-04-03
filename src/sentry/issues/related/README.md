# Summary

Issues in Sentry are created based on unique fingerprints based on the information from an event (e.g. the stack trace or the message). The Related Issues feature associates different issues based on the heuristics we will describe. This satisfies the desire of many customers to act on various issues together.

In the future, we will be implementing super groups ([read Armin's RFC on supergroups](https://github.com/getsentry/rfcs/pull/29)).

## Same root cause

In many cases, a bug or an environmental failure will create many Sentry issues which can be merged.
