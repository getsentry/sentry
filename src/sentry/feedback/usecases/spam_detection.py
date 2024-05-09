import logging

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(input):
    return f"""**Classification Task**
**Instructions: Please analyze the following input and output `spam` if the input is not coherent, and `notspam` if it is coherent.**
**Label Options:** spam, notspam

**Few-shot Examples:**
* **Example 1:** "asdasdfasd" -> spam
* **Example 2:** "It doesn't work," -> notspam
* **Example 3:** "es funktioniert nicht" -> notspam
* **Example 4:** "is there another way to do payment?" -> notspam
* **Example 5:** "this thing does not function how it should" -> notspam
* **Example 6:** "i was playing a great game now it crashed" -> notspam
* **Example 7:** "i can't login to my account wtf??!" -> notspam
* **Example 8:** "ฉันไม่สามารถเข้าสู่ระบบและไม่มีอะไรทำงาน " -> notspam

**Input Text:** "{input}"

**Classify:** """


@metrics.wraps("feedback.spam_detection", sample_rate=1.0)
def is_spam(message):
    is_spam = False
    trimmed_response = ""
    response = complete_prompt(
        usecase=LLMUseCase.SPAM_DETECTION,
        message=make_input_prompt(message),
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
