import logging

from sentry import features
from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.models.project import Project
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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


@metrics.wraps("feedback.spam_detection", sample_rate=1.0)
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
    return features.has(
        "organizations:user-feedback-spam-filter-ingest", project.organization
    ) and project.get_option("sentry:feedback_ai_spam_detection")
