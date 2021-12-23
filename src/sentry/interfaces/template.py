__all__ = ("Template",)

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import get_context


class Template(Interface):
    """
    A rendered template (generally used like a single frame in a stacktrace).

    The attributes ``filename``, ``context_line``, and ``lineno`` are required.

    >>>  {
    >>>     "abs_path": "/real/file/name.html"
    >>>     "filename": "file/name.html",
    >>>     "pre_context": [
    >>>         "line1",
    >>>         "line2"
    >>>     ],
    >>>     "context_line": "line3",
    >>>     "lineno": 3,
    >>>     "post_context": [
    >>>         "line4",
    >>>         "line5"
    >>>     ],
    >>> }

    .. note:: This interface can be passed as the 'template' key in addition
              to the full interface path.
    """

    score = 1100

    @classmethod
    def to_python(cls, data, **kwargs):
        for key in (
            "abs_path",
            "filename",
            "context_line",
            "lineno",
            "pre_context",
            "post_context",
        ):
            data.setdefault(key, None)

        return super().to_python(data, **kwargs)

    def to_string(self, event, is_public=False, **kwargs):
        context = get_context(
            lineno=self.lineno,
            context_line=self.context_line,
            pre_context=self.pre_context,
            post_context=self.post_context,
        )

        result = ["Stacktrace (most recent call last):", "", self.get_traceback(event, context)]

        return "\n".join(result)

    def get_traceback(self, event, context):
        """
        Prints a traceback for an exception.

        :param event: The AWS Lambda event object. This is passed implicitly by the Lambda service and contains data of
        the request sent to your code. It also has metadata about the request, such as which function was called and how long it took to process the request.
        :type event: dict

            :param context: The AWS Lambda context object. This is also passed implicitly by the Lambda service and contains runtime
        information about your code's execution, such as details about any exceptions that were thrown while processing your function, or information related
        to timing functions with `timeit`. 
            :type context: dict

                :returns str -- A string containing a formatted traceback for an exception raised
        in your function's code block.
        """
        result = [event.message, "", f'File "{self.filename}", line {self.lineno}', ""]
        result.extend([n[1].strip("\n") if n[1] else "" for n in context])

        return "\n".join(result)

    def get_api_context(self, is_public=False, platform=None):
        return {
            "lineNo": self.lineno,
            "filename": self.filename,
            "context": get_context(
                lineno=self.lineno,
                context_line=self.context_line,
                pre_context=self.pre_context,
                post_context=self.post_context,
            ),
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {
            "": meta.get(""),
            "lineNo": meta.get("lineno"),
            "filename": meta.get("filename"),
            "context": get_context(
                lineno=meta.get("lineno"),
                context_line=meta.get("context_line"),
                pre_context=meta.get("pre_context"),
                post_context=meta.get("post_context"),
            ),
        }
