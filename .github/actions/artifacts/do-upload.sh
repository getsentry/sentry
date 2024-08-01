#!/bin/bash
set -euo pipefail
pids=()

codecov_flags=(
  -t "$INPUT_TOKEN"
  --commit-sha "$INPUT_COMMIT_SHA"
  --plugin noop
  --flag "$INPUT_TYPE"
)


IFS=, read -r -a files <<<"$INPUT_FILES"
cmd=(./codecov --verbose upload-process "${codecov_flags[@]}")
for file in "${files[@]}"; do
  cmd+=(--file "$file")
done

( set -x; "${cmd[@]}" ) >upload-process.log 2>&1 &
pids+=(--pid $!)


IFS=, read -r -a files <<<"$INPUT_TEST_RESULT_FILES"
cmd=(./codecov --verbose do-upload --report-type test_results "${codecov_flags[@]}")
for file in "${files[@]}"; do
  cmd+=(--file "$file")
done

( set -x; "${cmd[@]}" ) >do-upload.log 2>&1 &
pids+=(--pid $!)


# wait, while showing un-interleaved logs
tail "${pids[@]}" -f upload-process.log do-upload.log
