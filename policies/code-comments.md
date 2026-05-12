# Code Comments

## Intent

Comments, docstrings, and JSDoc are for non-obvious intent, invariants, safety
boundaries, and tradeoffs.

They are not there to narrate obvious code.

## Policy

- Add comments when behavior is easy to misread, policy-driven, or coupled to
  a non-obvious invariant.
- Use brief docstrings or JSDoc for shared/public helpers, endpoints, hooks,
  components, or exported functions when future readers need intent, contract,
  or safety context to change them safely.
- Call out Sentry-specific boundaries when relevant: organization/project
  scoping, silo or cell behavior, customer-data constraints, retention/date
  assumptions, feature-flag rollout, and migration compatibility.
- Keep comments short and concrete. Explain why the code exists or what boundary it is protecting.
- Delete or rewrite stale comments immediately when behavior changes.

## Exceptions

- Do not comment obvious transformations, test setup, or control flow.
- Do not add comments that simply restate names or code in English.
- Do not preserve comments about removed or obsolete code paths.
