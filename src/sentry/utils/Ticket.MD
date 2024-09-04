General Infra Improvement

- set max duration on celery task
- add catch to task wrapper that will warn on celery task timeouts

Improving Commits

- Set maximum bounds for number of commits on a release
- Set maximum bounds for number of commit file changes on a release
- put TTL on release / commit / commitfilechange

- ? is there a way to do batching of the commit fetches?
