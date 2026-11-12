from sentry import analytics


@analytics.eventclass("signup_email_verification.sent")
class SignupEmailVerificationSentEvent(analytics.Event):
    email_hash: str
    signup_method: str


@analytics.eventclass("signup_email_verification.clicked")
class SignupEmailVerificationClickedEvent(analytics.Event):
    email_hash: str
    outcome: str  # "success", "expired", "tampered", "session_mismatch"
    signup_method: str


analytics.register(SignupEmailVerificationSentEvent)
analytics.register(SignupEmailVerificationClickedEvent)
