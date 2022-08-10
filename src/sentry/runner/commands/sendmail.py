import email

import click


def send_prepared_email(input, fail_silently=False):
    from sentry import options
    from sentry.utils.email import send_mail

    msg = email.message_from_string(input)
    headers = {k: v for (k, v) in msg.items() if k.lower() not in ("to", "reply-to", "subject")}
    reply_to = msg.get("reply-to")
    send_mail(
        subject=msg["subject"],
        message=msg.get_payload(),
        from_email=options.get("mail.from"),
        recipient_list=[msg["to"]],
        fail_silently=fail_silently,
        reply_to=[reply_to] if reply_to else None,
        headers=headers,
    )


@click.command()
@click.argument("files", nargs=-1)
@click.option("--fail-silently", is_flag=True)
def sendmail(files, fail_silently):
    """
    Sends emails from the default notification mail address.

    This functionality can be used to send a text email to users from the default
    send location.  The emails to be sent must be prepaired in plain text format
    with headers separated by body with double newlines.  Mandatory headers are
    `To` and `Subject`.
    """
    from sentry.runner import configure

    configure()

    for file in files:
        click.echo(f"Sending {file}")
        with open(file) as f:
            if not send_prepared_email(f.read(), fail_silently=fail_silently):
                click.echo(f"  error: Failed to send {file}")
