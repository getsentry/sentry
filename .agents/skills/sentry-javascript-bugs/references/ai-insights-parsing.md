# AI Insights Parsing Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

AI Insights parsing errors account for 2 issues and 3,005 events, but this cluster is escalating as new AI model formats are introduced. The core problem is that `JSON.parse` is called on AI prompt message data (`ai.prompt.messages` span attribute) that contains invalid JSON — bad escape characters, non-standard serialization, or plain text where JSON is expected.

## Real Examples

### [JAVASCRIPT-34D0]: Error parsing ai.prompt.messages (unresolved, 7 variants merged)

**Sentry**: https://sentry.io/issues/7002181641/
**Events**: 2,681 | **Users**: 95

**Stacktrace:**

```
./app/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput.tsx
  parseAIMessages
    -> JSON.parse(messages)

Underlying: SyntaxError: Bad escaped character in JSON at position 430
```

**Root cause:** The `parseAIMessages` function calls `JSON.parse` on the `ai.prompt.messages` span attribute. Various LLM providers serialize messages differently and some produce strings with raw newlines, unescaped backslashes, or invalid unicode sequences that are not valid JSON. The function does not catch the parsing error.

**Fix pattern:**

```typescript
function parseAIMessages(raw: string): AIMessage[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [{role: 'unknown', content: raw}];
  }
}
```

### [JAVASCRIPT-379Y]: Error parsing gen_ai messages with parts format (unresolved, escalating)

**Sentry**: https://sentry.io/issues/7270138341/
**Events**: 324 | **Users**: 17

**Stacktrace:**

```
./app/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput.tsx
  transformPartsMessages
    -> JSON.parse(message)

Underlying: SyntaxError: JSON.parse: unexpected character at line 1 column 2
```

**Root cause:** The "parts" format handler encounters message data that is not valid JSON. Some AI models serialize multi-modal content (text + images) in non-standard formats. The parser assumes all parts-format messages are JSON but some are plain text or use custom serialization.

**Fix pattern:**

```typescript
function transformPartsMessages(raw: string): TransformedMessage {
  if (!raw) return {type: 'text', content: ''};
  if (!raw.startsWith('[') && !raw.startsWith('{')) {
    return {type: 'text', content: raw};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {type: 'text', content: raw};
  }
}
```

## Detection Checklist

- [ ] Is `JSON.parse` called on AI/LLM span data without try-catch?
- [ ] Does the parser handle non-JSON input (plain text, custom formats)?
- [ ] Is there a fallback rendering path for unparseable messages?
- [ ] Are new AI model output formats validated before being passed to parsers?
- [ ] Does the code check for leading `[` or `{` before attempting JSON parse?
