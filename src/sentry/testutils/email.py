from django.core.mail.backends.dummy import EmailBackend

sent_messages = []


class MockEmailBackend(EmailBackend):
    def send_messages(self, email_messages):
        sent_messages.extend(email_messages)
        return len(list(email_messages))
