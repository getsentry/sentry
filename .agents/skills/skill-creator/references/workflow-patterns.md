# Workflow Patterns

Patterns for structuring multi-step workflows and decision logic in skills.

## Sequential Workflows

Break complex tasks into numbered steps. Give an overview early in SKILL.md so the agent knows the full process before starting.

```markdown
Filling a PDF form involves these steps:

1. Analyze the form (run analyze_form.py)
2. Create field mapping (edit fields.json)
3. Validate mapping (run validate_fields.py)
4. Fill the form (run fill_form.py)
5. Verify output (run verify_output.py)
```

For particularly complex workflows, provide a checklist the agent can track:

```markdown
Copy this checklist and track progress:

- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
```

## Conditional Workflows

Guide agents through decision points with clear branching:

```markdown
1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   - Export to .docx format

3. Editing workflow:
   - Unpack existing document
   - Modify XML directly
   - Validate after each change
   - Repack when complete
```

When branches get large, push them into separate reference files:

```markdown
| Task Type | Read This Reference |
|-----------|-------------------|
| Creating documents | `${CLAUDE_SKILL_ROOT}/references/creation.md` |
| Editing documents | `${CLAUDE_SKILL_ROOT}/references/editing.md` |
```

## Feedback Loops

Use a validate-fix-repeat pattern for tasks where output quality matters:

```markdown
## Validation loop

1. Make edits to the document
2. Validate immediately: `uv run ${CLAUDE_SKILL_ROOT}/scripts/validate.py`
3. If validation fails:
   - Review the error message
   - Fix the issues
   - Run validation again
4. Only proceed when validation passes
```

This pattern works for:
- Code generation (lint → fix → re-lint)
- Document editing (validate XML → fix → re-validate)
- Data processing (check schema → fix → re-check)
- Form filling (validate fields → fix → re-validate)

## Plan-Validate-Execute

For complex, high-stakes tasks, have the agent create a plan file before executing:

```markdown
1. Analyze the input and generate `changes.json` with planned modifications
2. Validate the plan: `uv run ${CLAUDE_SKILL_ROOT}/scripts/validate_plan.py changes.json`
3. If validation fails, revise the plan and re-validate
4. Execute the plan: `uv run ${CLAUDE_SKILL_ROOT}/scripts/apply_changes.py changes.json`
5. Verify the result
```

Benefits:
- Catches errors before changes are applied
- Machine-verifiable intermediate output
- Agent can iterate on the plan without touching originals
- Clear debugging — error messages point to specific plan entries

Use this pattern for: batch operations, destructive changes, complex data transformations.
