# Testing the Weekly Report Email

This guide shows you how to generate a test weekly report email to preview the logs feature.

## Prerequisites

1. Make sure devservices are running:

   ```bash
   devservices up
   ```

2. You need an organization and a user in your local database.

## Quick Start

### Option 1: Using `sentry exec` (Recommended)

```bash
sentry exec scripts/test_weekly_report.py --org <YOUR_ORG_SLUG> --user <YOUR_EMAIL>
```

Example:

```bash
sentry exec scripts/test_weekly_report.py --org sentry --user admin@localhost
```

### Option 2: Direct Python

First, make sure you have the virtualenv activated, then:

```bash
python scripts/test_weekly_report.py --org <YOUR_ORG_SLUG> --user <YOUR_EMAIL>
```

## Options

- `--org` (required): Organization slug (e.g., "sentry")
- `--user` (required): User email address (e.g., "admin@localhost")
- `--days`: Number of days to include (default: 7)
- `--dry-run`: Generate report but don't send email (useful for testing)

## Examples

### Generate and send email

```bash
sentry exec scripts/test_weekly_report.py --org sentry --user admin@localhost
```

### Test without sending (dry run)

```bash
sentry exec scripts/test_weekly_report.py --org sentry --user admin@localhost --dry-run
```

### Use a custom time period (14 days)

```bash
sentry exec scripts/test_weekly_report.py --org sentry --user admin@localhost --days 14
```

## Where to Find the Email

### If you're using the console email backend (default in dev):

The email HTML will be printed to your console/terminal.

### If you're using a real email backend:

Check your email at the address you specified.

### Save HTML to file for browser preview:

If the email is printed to console, you can:

1. Copy the HTML output
2. Save it to a file: `/tmp/weekly_report.html`
3. Open in browser: `open /tmp/weekly_report.html`

## Viewing Logs in the Email

The email will show logs data if:

1. Your projects have log data in the time period
2. The OurLogs dataset is available and working

If you don't have log data yet, the logs sections will simply not appear (empty state).

## Troubleshooting

### "Organization not found"

- List available organizations: `sentry django shell` then `Organization.objects.values_list('slug', flat=True)`

### "User not found"

- List available users: `sentry django shell` then `User.objects.values_list('email', flat=True)`

### No email received

- Check if you're using console email backend (default in dev)
- Check your `config.yml` or environment variables for email settings
- Look for the email HTML in your terminal output

### Logs sections not appearing

- This is expected if you don't have log data
- The email gracefully handles empty log data
- To test with logs, you need to send logs to your local Sentry instance first

## Next Steps

After previewing the email:

1. Take screenshots of the different sections
2. Test with real log data if available
3. Share feedback on the design/layout
