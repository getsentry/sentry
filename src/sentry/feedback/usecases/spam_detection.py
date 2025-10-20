import logging

from sentry import features
from sentry.feedback.lib.seer_api import seer_summarization_connection_pool
from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.models.project import Project
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

SEER_SPAM_DETECTION_ENDPOINT_PATH = "/v1/automation/summarize/feedback/spam-detection"
SEER_TIMEOUT_S = 15
SEER_RETRIES = 0


@metrics.wraps("feedback.spam_detection_seer")
def is_spam_seer(message: str, organization_id: int) -> bool | None:
    """
    Check if a message is spam using Seer.

    Returns True if the message is spam, False otherwise.
    Returns None if the request fails.
    """
    seer_request = {
        "organization_id": organization_id,
        "feedback_message": message,
    }

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_summarization_connection_pool,
            path=SEER_SPAM_DETECTION_ENDPOINT_PATH,
            body=json.dumps(seer_request).encode("utf-8"),
            timeout=SEER_TIMEOUT_S,
            retries=SEER_RETRIES,
        )
        response_data = response.json()
    except Exception:
        logger.exception("Seer failed to check if message is spam")
        return None

    if response.status < 200 or response.status >= 300:
        logger.error(
            "Seer failed to check if message is spam",
            extra={"status_code": response.status, "response_data": response.data},
        )
        return None

    if (
        not isinstance(response_data, dict)
        or "is_spam" not in response_data
        or not isinstance(response_data["is_spam"], bool)
    ):
        logger.error(
            "Seer returned an invalid spam detection response",
            extra={"response_data": response.data},
        )
        return None
    return response_data["is_spam"]


def make_input_prompt(message: str):
    # if you decide not to lower-case the message, remember to add capitals to the examples
    return f"""**Classification Task**
**Instructions: Please analyze the following input and output `spam` if the input is not coherent, and `notspam` if it is coherent. If the user is frustrated but describing a problem, that is notspam**
**Label Options:** spam, notspam

**Few-shot Examples:**
* **Example 1:** "asdasdfasd" -> spam
* **Example 2:** "it doesn't work," -> notspam
* **Example 3:** "es funktioniert nicht" -> notspam
* **Example 4:** "is there another way to do payment?" -> notspam
* **Example 5:** "this thing does not function how it should" -> notspam
* **Example 6:** "i was playing a great game now it crashed" -> notspam
* **Example 7:** "i can't login to my account wtf??!" -> notspam
* **Example 8:** "ฉันไม่สามารถเข้าสู่ระบบและไม่มีอะไรทำงาน " -> notspam
* **Example 9:** "crashed" -> notspam
* **Example 10:** "my game glitched grrrr!!!!" -> notspam
* **Example 11:** "this piece of junk does not work!!!" -> notspam

**Input Text:** "{message.lower()}"

**Classify:** """


@metrics.wraps("feedback.spam_detection")
def is_spam(message: str):
    labeled_spam = False
    response = complete_prompt(
        usecase=LLMUseCase.SPAM_DETECTION,
        message=make_input_prompt(message),
        temperature=0,
        max_output_tokens=20,
    )
    if response:
        labeled_spam, _ = trim_response(response)

    return labeled_spam


def trim_response(text):
    trimmed_text = text.strip().lower()

    trimmed_text.replace("`", "")

    import re

    trimmed_text = re.sub(r"\W+", "", trimmed_text)

    if trimmed_text in ("spam", "[spam]"):
        return True, trimmed_text
    else:
        return False, trimmed_text


def spam_detection_enabled(project: Project) -> bool:
    has_spam_enabled = features.has(
        "organizations:user-feedback-spam-ingest", project.organization
    ) and project.get_option("sentry:feedback_ai_spam_detection")

    has_ai_enabled = has_seer_access(project.organization)

    return has_spam_enabled and has_ai_enabled
