# Policies

Policies are short repo-wide defaults.

Use a policy doc when we want to say "this is how we normally do this here"
without turning it into a full architecture document or feature spec.

Good policy topics:

- API design and migration shape
- code comments, docstrings, and JSDoc
- testing expectations
- naming conventions
- migration hygiene
- automation safety boundaries

Keep policy docs small:

- explain the intent briefly
- state the default rule clearly
- call out only the meaningful exceptions

Use `policies/TEMPLATE.md` for new policies.
