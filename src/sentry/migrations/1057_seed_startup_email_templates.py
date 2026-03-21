"""
Seed initial email templates for the startup program.
"""

from django.db import migrations


TEMPLATES = [
    {
        "name": "welcome_io",
        "display_name": "Welcome — Sentry for Startups",
        "subject": "Welcome to Sentry for Startups!",
        "body": (
            "Hi {{name}},\n\n"
            "Great news — {{company}} has been approved for the Sentry for Startups program!\n\n"
            "We've applied $5,000 in credits to your Sentry account (org: {{slug}}). "
            "These credits will be automatically applied to your usage.\n\n"
            "If you have any questions, just reply to this email.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": None,
    },
    {
        "name": "welcome_yc",
        "display_name": "Welcome — YC Program",
        "subject": "Welcome to Sentry for Startups (YC)!",
        "body": (
            "Hi {{name}},\n\n"
            "Great news — {{company}} has been approved for the Sentry for Startups program "
            "through Y Combinator!\n\n"
            "We've applied $5,000 in credits to your Sentry account (org: {{slug}}). "
            "Note that this program provides 2 years of credits.\n\n"
            "If you have any questions, just reply to this email.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": None,
    },
    {
        "name": "reject_too_much_funding",
        "display_name": "Rejection — Too Much Funding",
        "subject": "Sentry for Startups Application Update",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for your interest in the Sentry for Startups program.\n\n"
            "Unfortunately, we're unable to approve {{company}} at this time. "
            "Our program is designed for early-stage startups that have raised less than "
            "$5M in venture capital.\n\n"
            "We'd still love to have you as a Sentry customer — check out our plans at "
            "sentry.io/pricing.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": "too_much_funding",
    },
    {
        "name": "reject_already_paying",
        "display_name": "Rejection — Already Paying",
        "subject": "Sentry for Startups Application Update",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for your interest in the Sentry for Startups program.\n\n"
            "It looks like {{company}} already has a paid Sentry subscription. "
            "The startup program is designed for organizations that are new to paying for Sentry.\n\n"
            "If you have questions about your current plan, please reach out to support.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": "already_paying",
    },
    {
        "name": "reject_bad_org",
        "display_name": "Rejection — Bad Org",
        "subject": "Sentry for Startups Application Update",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for applying to the Sentry for Startups program.\n\n"
            "We weren't able to find a valid Sentry organization matching the slug you provided "
            "({{slug}}). Please make sure you have a free Sentry account set up and try applying "
            "again with the correct organization slug.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": "bad_org",
    },
    {
        "name": "reject_duplicate",
        "display_name": "Rejection — Duplicate",
        "subject": "Sentry for Startups Application Update",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for your interest in Sentry for Startups.\n\n"
            "It looks like we've already received an application for {{company}}. "
            "If you believe this is an error, please reply to this email.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": "duplicate",
    },
    {
        "name": "needs_info",
        "display_name": "Needs More Information",
        "subject": "Sentry for Startups — Additional Information Needed",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for applying to the Sentry for Startups program.\n\n"
            "We need a bit more information before we can review your application for {{company}}. "
            "Could you please reply with:\n\n"
            "- Your company website (if different from what was provided)\n"
            "- Additional details about your funding stage\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": None,
    },
    {
        "name": "reject_other",
        "display_name": "Rejection — Other",
        "subject": "Sentry for Startups Application Update",
        "body": (
            "Hi {{name}},\n\n"
            "Thank you for your interest in the Sentry for Startups program.\n\n"
            "Unfortunately, we're unable to approve {{company}} for the program at this time.\n\n"
            "We'd still love to have you as a Sentry customer — check out our plans at "
            "sentry.io/pricing.\n\n"
            "Best,\nThe Sentry Team"
        ),
        "rejection_reason": "other",
    },
]


def seed_startup_email_templates(apps, schema_editor):
    StartupEmailTemplate = apps.get_model("sentry", "StartupEmailTemplate")
    for template in TEMPLATES:
        StartupEmailTemplate.objects.update_or_create(
            name=template["name"],
            defaults={
                "display_name": template["display_name"],
                "subject": template["subject"],
                "body": template["body"],
                "rejection_reason": template["rejection_reason"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("sentry", "1056_add_startup_program_models"),
    ]

    operations = [
        migrations.RunPython(
            seed_startup_email_templates,
            migrations.RunPython.noop,
        ),
    ]
