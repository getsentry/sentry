import logging

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)

PROMPT = """
Please analyze the following input and output `spam` if the input is not coherent, and `not spam` if it is coherent.
Some example responses:
  asdfasdf,spam
  It doesn't work,not spam
  es funktioniert nicht, not spam
  لا يعمل,not spam,
  Nothing,spam
  ..,spam
  hey,spam
Complete the following:
"""


@metrics.wraps("feedback.spam_detection", sample_rate=1.0)
def is_spam(message):
    is_spam = False
    trimmed_response = ""
    response = complete_prompt(
        usecase=LLMUseCase.SPAM_DETECTION,
        prompt=PROMPT,
        message=message + ",",  # add a comma so it knows to complete the csv
        temperature=0,
        max_output_tokens=20,
    )
    if response:
        is_spam, trimmed_response = trim_response(response)

    logger.info(
        "Spam detection",
        extra={
            "feedback_message": message,
            "is_spam": is_spam,
            "response": response,
            "trimmed_response": trimmed_response,
        },
    )
    metrics.incr("spam-detection", tags={"is_spam": is_spam}, sample_rate=1.0)
    return is_spam


def trim_response(text):
    trimmed_text = text.strip().lower()

    trimmed_text.replace("`", "")

    import re

    trimmed_text = re.sub(r"\W+", "", trimmed_text)

    if trimmed_text in ("spam", "[spam]"):
        return True, trimmed_text
    else:
        return False, trimmed_text
