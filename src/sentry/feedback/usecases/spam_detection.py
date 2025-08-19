import logging

import sentry_sdk
from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(input):
    return f"""**Classification Task**
**Instructions: Please analyze the following input and output `spam` if the input is not coherent, and `notspam` if it is coherent. If the user is frustrated but describing a problem, that is notspam**
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
* **Example 9:** "crashed" -> notspam
* **Example 9:** "MY GAME GLITCHED GRRRR!!!!" -> notspam
* **Example 10:** "THIS PIECE OF JUNK DOES NOT WORK!!!" -> notspam

**Input Text:** "{input}"

**Classify:** """


@metrics.wraps("feedback.spam_detection", sample_rate=1.0)
def is_spam(message):
    with sentry_sdk.start_span(op="feedback.spam_detection", description="Detecting spam in feedback message") as span:
        span.set_tag("message_length", len(message))
        
        is_spam = False
        trimmed_response = ""
        
        with sentry_sdk.start_span(op="feedback.spam_detection.llm_prompt", description="Generating LLM prompt"):
            prompt = make_input_prompt(message)
            
        with sentry_sdk.start_span(op="feedback.spam_detection.llm_request", description="Requesting LLM completion"):
            response = complete_prompt(
                usecase=LLMUseCase.SPAM_DETECTION,
                message=prompt,
                temperature=0,
                max_output_tokens=20,
            )
            span.set_tag("llm_response_received", bool(response))
            
        if response:
            with sentry_sdk.start_span(op="feedback.spam_detection.parse_response", description="Parsing LLM response"):
                is_spam, trimmed_response = trim_response(response)
                span.set_tag("is_spam", is_spam)

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
    with sentry_sdk.start_span(op="feedback.spam_detection.trim_response", description="Trimming and parsing LLM response"):
        trimmed_text = text.strip().lower()

        trimmed_text.replace("`", "")

        import re

        trimmed_text = re.sub(r"\W+", "", trimmed_text)

        if trimmed_text in ("spam", "[spam]"):
            return True, trimmed_text
        else:
            return False, trimmed_text
