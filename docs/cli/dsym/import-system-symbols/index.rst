`sentry dsym import-system-symbols [BUNDLES]...`
------------------------------------------------

Imports system symbols from preprocessed zip files into Sentry.

It takes a list of zip files as arguments that contain preprocessed
system symbol information.  These zip files contain JSON dumps.  The
actual zipped up dsym files cannot be used here, they need to be
preprocessed.

Options
```````

- ``--threads INTEGER``: The number of threads to use
- ``--trim-symbols``: If enabled symbols are trimmed before storing. This
  reduces the database size but means that symbols are already trimmed on
  the way to the database.
- ``--no-demangle``: If this is set to true symbols are never demangled.
  By default symbols are demangled if they are trimmed or demangled
  symbols are shorter than mangled ones. Enabling this option speeds up
  importing slightly.
- ``--help``: print this help page.
