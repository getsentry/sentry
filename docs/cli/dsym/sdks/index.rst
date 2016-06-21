`sentry dsym sdks`
------------------

Print a list of all installed SDKs and a breakdown of the symbols
contained within.  This queries the system symbol database and reports
all SDKs and versions that symbols exist for.  The output is broken down
by minor versions, builds and cpu architectures.  For each of those a
count of the stored bundles is returned.  (A bundle in this case is a
single binary)

Options
```````

- ``--sdk TEXT``: Only include the given SDK instead of all.
- ``--version TEXT``: Optionally a version filter.  For instance 9 returns
  all versions 9.*, 9.1 returns 9.1.* etc.
- ``--help``: print this help page.
