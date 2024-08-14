# Backup tests

This directory tests a number of scenarios where we take an empty database, import a given backup
`.json` file, optionally perform some transform, re-export it and validate the diff. The expected
result is that only the changes we have made are reflected in the final diff between the original
input `.json` that we imported, and the final output `.json` that we exported.

## Comparators

A number of fields in the export JSON format are not so easily compared before and after running
through an import/export cycle. We introduce "comparators" to account for such cases. Comparators
are custom, model-specific ways of comparing portions of two json files that take into account more
nuanced validations beyond the simple character-for-character matching that the default diffing
algorithm provides for us.

For example, `date_updated` fields that change due to the very act of importing the JSON, or hashes
that may change between import and export. In these cases, we may choose to simply validate that the
exported `date_updated` is greater than the imported value for the same model instance, or that
hashes match some general regex rule around size and valid characters without being identical.

Comparator functions should implement the `JSONMutatingComparator` callback protocol, and be
included in the `COMPARATORS` dictionary, matching them to the models they are applicable to. Note
that the comparator is explicitly described as "mutating" - this is important, as part of its
functionality is to _modify the compared fields in both the expected and actual output, so that
text-based JSON diffing does not fail on them_. In the example above, the `date_updated` field in
_both_ the expected and actual JSON should be replaced with some obvious sentinel value indicating
that a comparator-initiated mutation took place, like `__COMPARATOR_DATE_UPDATED__`.

While it may be tempting to remove the offending field, or to make the actual match the expected
after the comparison is completed, this is discouraged, as it will result in the subsequent JSON
diff looking identical, potentially confusing future readers. Better to just throw up a very obvious
signal that "a framework-generated replacement occurred here" to make future debugging less
stressful.

## Snapshots

A number of default starter snapshots are provided to bootstrap this test flow.

### fresh_install.json

This represents the state of the database immediately after running `./install.sh` to create a new
instance of `self-hosted`.
