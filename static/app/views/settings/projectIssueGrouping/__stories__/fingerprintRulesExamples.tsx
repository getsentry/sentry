import {useState} from 'react';

import {FingerprintRulesEditor} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesEditor';

// Kept out of the MDX file, where the formatter reads `#` comment lines as headings

export const validRules = `# Group all database outages together
error.type:DatabaseUnavailable -> system-down

# Split by function, with a custom title
stack.function:malloc -> memory-allocation-error, {{ stack.function }} title="Out of memory in {{ function }}"

# Negate a matcher, quote values with spaces, and match on tags
!logger:"my app.*" tags.environment:production -> "prod errors", {{ default }}`;

export const mistakes = `# An arrow from another language
error.type:DatabaseUnavailable => system-down
# A unicode arrow
error.type:SocketError → sockets
# No space before the arrow
error.type:TimeoutError-> timeouts
# An unquoted title becomes more fingerprint values
error.type:KeyError -> key-errors title=Key errors
# A trailing comment becomes part of the fingerprint
error.type:TypeError -> type-errors # group type errors`;

export const longRules = Array.from(
  {length: 40},
  (_, i) =>
    `error.type:GeneratedError${i} message:"Something went wrong in step ${i} of the pipeline" -> pipeline-step-${i}, {{ default }}`
).join('\n');

export function EditorDemo({initialValue}: {initialValue: string}) {
  const [value, setValue] = useState(initialValue);
  return (
    <FingerprintRulesEditor
      aria-label="Fingerprint rules"
      value={value}
      onChange={setValue}
      rows={2}
      maxRows={20}
    />
  );
}
