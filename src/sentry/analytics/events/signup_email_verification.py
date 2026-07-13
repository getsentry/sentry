from sentry import analytics


@analytics.eventclass("signup_email_verification.clicked")
class SignupEmailVerificationClickedEvent(analytics.Event):
    email_hash: str
    outcome: str  # "success", "expired", "tampered", "session_mismatch"


analytics.register(SignupEmailVerificationClickedEvent)
