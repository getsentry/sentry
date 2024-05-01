import logging

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)

PROMPT = """Classify the text into one of the following two classes: [Junk, Not Junk]. Choose Junk only if you are confident. Text: """


@metrics.wraps("feedback.spam_detection", sample_rate=1.0)
def is_spam(message):
    is_spam = False
    response = complete_prompt(usecase=LLMUseCase.SPAM_DETECTION, prompt=PROMPT, message=message)
    if response and response.lower() in ("junk", "[junk]"):
        is_spam = True

    logger.info(
        "Spam detection",
        extra={
            "feedback_message": message,
            "is_spam": is_spam,
            "response": response,
        },
    )
    metrics.incr("spam-detection", tags={"is_spam": is_spam}, sample_rate=1.0)
    return is_spam
