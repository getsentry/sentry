# Summary

This module is based on [Armin's RFC for supergroups](https://github.com/getsentry/rfcs/pull/29).

The term supergroup on the original RFC has been changed to related issues in this document.

Not all types of supergroup cases have been introduced in this document but only the type we're handling in this module.

## Motivation

Issues in Sentry are created based on unique fingerprints based on the information from an event like the stack trace or the message. The Related Issues feature associates different issues based on various heuristics that we will describe. Related Issues will allow the customer to act on many related issues all at once.

Future iterations of this project are being worked on but we may promote these heuristics to generate fingerprints (reducing group creation) or create a representative group in the issue stream for all related issues (abstracting all other created groups).

## Cases

XXX: Continue here
