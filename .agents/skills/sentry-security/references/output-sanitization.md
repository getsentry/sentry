# Output Sanitization Patterns

## Contents

- Email template injection
- Markdown rendering
- HTML safety

## Email Template Injection

User-controlled strings (display names, team names, org names) rendered in email templates can contain HTML that gets interpreted by email clients.

### Real vulnerability: Display name injection (PR #108165, #108154)

User display names in invite and team access request emails were not sanitized. An attacker could set their display name to HTML that would render in the recipient's email client.

**Vulnerable pattern:**

```python
# User display name inserted directly into email context
context = {
    "requester_name": requesting_user.get_display_name(),
    # ... rendered in HTML email template without escaping
}
```

**Fixed pattern:**

```python
from django.utils.html import escape

context = {
    "requester_name": escape(requesting_user.get_display_name()),
}
```

### Where to look

Any code that puts user-provided strings into email context:

- `get_display_name()`, `get_username()`, `name` fields
- Team names, organization names, project names
- Any string that a user can set that later appears in an email

Search pattern:

```
grep -rn "get_display_name\|get_username\|\.name" --include="*.py" src/sentry/notifications/
grep -rn "get_display_name\|get_username\|\.name" --include="*.py" src/sentry/mail/
```

## Markdown Rendering

### Real vulnerability: Custom CSS in marked (PR #106368)

The markdown renderer allowed custom CSS through `<style>` tags, enabling CSS-based attacks.

**What to check:**

- Markdown rendering configuration: does it strip HTML tags?
- Are `<style>`, `<script>`, or `<iframe>` tags allowed?
- Is `mark_safe()` called on markdown output without sanitization?

## HTML Safety in Django

### format_html() vs string concatenation

```python
# WRONG: String concatenation — XSS if user_name contains HTML
html = f"<p>Hello {user_name}</p>"
return mark_safe(html)

# RIGHT: format_html escapes parameters
from django.utils.html import format_html
html = format_html("<p>Hello {}</p>", user_name)
```

### mark_safe() with user input

`mark_safe()` should never be called on strings containing user input. Search for:

```
grep -rn "mark_safe" --include="*.py" src/sentry/
```

Flag any usage where the string argument includes user-controlled data.

## Checklist

```
□ User display names are escaped before use in email templates
□ Team/org/project names are escaped in email context
□ Markdown renderer strips HTML tags (especially style, script, iframe)
□ mark_safe() is never called on user-provided data
□ format_html() is used instead of string concatenation for HTML
```
