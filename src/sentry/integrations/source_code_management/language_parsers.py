from __future__ import annotations

import re
from abc import ABC

from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Function, Op

from sentry import features
from sentry.integrations.source_code_management.constants import STACKFRAME_COUNT
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization

stackframe_function_name = lambda i: Function(
    "arrayElement",
    (Column("exception_frames.function"), i),
)


class SimpleLanguageParser(ABC):
    regexes: list[str]

    @classmethod
    def extract_functions_from_patch(cls, patch: str) -> set[str]:
        functions = set()
        for regex in cls.regexes:
            functions.update(set(re.findall(regex, patch, flags=re.M)))

        return functions

    @classmethod
    def generate_multi_if(cls, function_names: list[str]) -> list[Function]:
        """
        Fetch the function name from the stackframe that matches a name within the list of function names.
        """
        multi_if = []
        for i in range(-STACKFRAME_COUNT, 0):
            # if, then conditions
            multi_if.extend(
                [
                    Function(
                        "in",
                        [
                            stackframe_function_name(i),
                            function_names,
                        ],
                    ),
                    stackframe_function_name(i),
                ]
            )
        # else condition
        multi_if.append(stackframe_function_name(-1))

        return multi_if

    @classmethod
    def generate_function_name_conditions(
        cls, function_names: list[str], stack_frame: int
    ) -> Condition:
        """Check if the function name in the stack frame is within the list of function names."""
        return Condition(
            stackframe_function_name(stack_frame),
            Op.IN,
            function_names,
        )


class LanguageParser(ABC):
    regexes: list[str]
    function_prefix: str

    @classmethod
    def extract_functions_from_patch(cls, patch: str) -> set[str]:
        functions = set()
        for regex in cls.regexes:
            functions.update(set(re.findall(regex, patch, flags=re.M)))

        return functions

    @classmethod
    def _get_function_name_conditions(cls, stackframe_level: int, function_names: list[str]):
        """
        For some languages we need a special case of matching both for the function name itself and for
        {function_prefix} + the function name, because sometimes Snuba stores the function name as
        "className+{function_prefix}+functionName".
        """
        prepended_function_names = [
            "%" + cls.function_prefix + function_name for function_name in function_names
        ]
        function_name_conditions = [
            Condition(
                stackframe_function_name(stackframe_level),
                Op.LIKE,
                function_name,
            )
            for function_name in prepended_function_names
        ]
        function_name_conditions.append(
            Condition(
                stackframe_function_name(stackframe_level),
                Op.IN,
                function_names,
            ),
        )
        return function_name_conditions

    @classmethod
    def _get_function_name_functions(cls, stackframe_level: int, function_names: list[str]):
        """
        This is used in the multi_if. We need to account for the special cases in some languages order to
        properly fetch the function name -- "className+{function_prefix}+functionName" or simply "functionName" depending
        on what matches in the stack trace.
        """
        prepended_function_names = [
            "%" + cls.function_prefix + function_name for function_name in function_names
        ]
        function_name_conditions = [
            Function(
                "like",
                [
                    stackframe_function_name(stackframe_level),
                    function_name,
                ],
            )
            for function_name in prepended_function_names
        ]
        function_name_conditions.append(
            Function(
                "in",
                [
                    stackframe_function_name(stackframe_level),
                    function_names,
                ],
            )
        )
        return function_name_conditions

    @classmethod
    def generate_multi_if(cls, function_names: list[str]) -> list[Function]:
        """
        Fetch the function name from the stackframe that matches a name within the list of function names.
        """
        multi_if = []
        for i in range(-STACKFRAME_COUNT, 0):
            # if, then conditions
            stackframe_function_name_conditions = cls._get_function_name_functions(
                i, function_names
            )
            multi_if.extend(
                [
                    Function("or", stackframe_function_name_conditions),
                    stackframe_function_name(i),
                ]
            )
        # else condition
        multi_if.append(stackframe_function_name(-1))

        return multi_if

    @classmethod
    def generate_function_name_conditions(
        cls, function_names: list[str], stack_frame: int
    ) -> Condition:
        """
        Function to generate the WHERE condition for matching function names from a list to function names in the stack trace in the Snuba request.
        Must be applied to each frame of the stacktrace up to STACKFRAME_COUNT.
        """
        return BooleanCondition(
            BooleanOp.OR,
            cls._get_function_name_conditions(stack_frame, function_names),
        )


class PythonParser(SimpleLanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    r"""
    Function header regex pattern
    ^           - Asserts the start of a line.
    @@.*@@      - Matches a string that starts with two "@" characters, followed by any characters
                (except newline), and ends with two "@" characters.
    \s+         - Matches one or more whitespace characters (spaces, tabs, etc.).
    def         - Matches the literal characters "def".
    \\s+         - Matches one or more whitespace characters.
    (?P<fnc>.*) - This is a named capturing group that captures any characters (except newline)
                and assigns them to the named group "fnc".
    \(          - Matches an opening parenthesis "(".
    .*          - Matches any characters (except newline).
    $           - Asserts the end of a line.
    """

    python_function_regex = r"^@@.*@@\s+def\s+(?P<fnc>.*)\(.*$"

    regexes = [python_function_regex]


class RubyParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    function_prefix = "."

    function_declaration_regex = r"^@@.*@@\s+def\s+(?:\w+\.)?(?P<fnc>\w+).*$"
    dynamic_method_declaration_regex = r"^@@.*@@\s+define_method\s+:(?P<fnc>\w+).*$"
    lambda_arrow_function_regex = r"^@@.*@@\s+(?P<fnc>\w+)\s*=\s*->.*$"
    lambda_word_function_regex = r"^@@.*@@\s+(?P<fnc>\w+)\s*=\s*lambda.*$"

    regexes = [
        function_declaration_regex,
        dynamic_method_declaration_regex,
        lambda_arrow_function_regex,
        lambda_word_function_regex,
    ]


class JavascriptParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** `Affected Users:` **{affected_users}** |"

    function_prefix = "."

    r"""
    Type of function declaration    Example
    Function declaration:           function hello(argument1, argument2)
    Arrow function:                 export const blue = (argument) => {
    Function expression:            const planet = async function(argument) {
    Function constructor:           const constructor = new Function(
    """
    function_declaration_regex = r"^@@.*@@[^=]*?\s*function\s+(?P<fnc>[^\(]*)\(.*$"
    arrow_function_regex = (
        r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^=\n]*)\s+=[^>\n]*[\(^\n*\)]?\s*=>.*$"
    )
    function_expression_regex = (
        r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^\(\n]*)\s+=.*\s+function.*\(.*$"
    )
    function_constructor_regex = (
        r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^\(\n]*)\s+=\s+new\s+Function\(.*$"
    )

    regexes = [
        function_declaration_regex,
        arrow_function_regex,
        function_expression_regex,
        function_constructor_regex,
    ]


class PHPParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    function_prefix = "::"

    r"""
    Type of function declaration    Example
    Function declaration:           public static function hello(argument1, argument2)
    Anonymous Function:             $hello = function(argument1, argument2)
    Arrow function:                 $arrowFunc = fn($parameter) => $parameter + 1;
    """
    function_declaration_regex = r"^@@.*@@[^=]*?\s*function\s+(?P<fnc>\w+)\s*\("
    anonymous_function_regex = r"^@@.*@@.*\s+\$(?P<fnc>\w+)\s*=\s*\w*\s*function\s*\(.*$"
    arrow_function_regex = r"^@@.*@@.*\s+\$(?P<fnc>\w+)\s*=\s*\w*\s*fn\([^)]*\)\s*=>.*$"

    regexes = [
        function_declaration_regex,
        arrow_function_regex,
        anonymous_function_regex,
    ]


class CSharpParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    function_prefix = "."

    r"""
    Type of method declaration                           Example
    Regular method:                                     public void MethodName()
    Static method:                                      public static int Calculate(int x)
    Async method:                                       public async Task<string> ProcessAsync()
    Constructor:                                        public ClassName()
    Static constructor:                                 static ClassName()
    Destructor/Finalizer:                              ~ClassName()
    Operator overload:                                  public static ClassName operator+(ClassName a)
    Expression-bodied method:                           public int Add(int x) => x + 1;
    Property getter/setter:                             get { return _value; }
    Local function:                                     void LocalFunction()
    Interface method implementation:                    void IInterface.Method()
    """

    # Regular method declarations with access modifiers - exclude operator declarations
    method_declaration_regex = r"^@@.*@@(?!.*\boperator\b)[^=]*?\s*(?:\[[^\]]*\]\s*)?(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async|extern|unsafe)?\s*(?:async)?\s*(?:\w+\??(?:<[^>]*>)?(?:\[\])?\s+)?(?P<fnc>\w+)\s*\("

    # Constructor declarations (including static constructors) - exclude operator declarations
    constructor_regex = r"^@@.*@@(?!.*\boperator\b)[^=]*?\s*(?:public|private|protected|internal)?\s*(?:static)?\s*(?P<fnc>\w+)\s*\([^)]*\)\s*(?::\s*(?:base|this)\([^)]*\))?\s*$"

    # Destructor/Finalizer
    destructor_regex = r"^@@.*@@[^=]*?\s*~(?P<fnc>\w+)\s*\(\s*\)"

    # Operator overloads - split into standard operators and conversion operators
    operator_standard_regex = r"^@@.*@@[^=]*?\s*(?:public|private|protected|internal)?\s*static\s*\w+\s*operator\s*(?P<fnc>[+\-*/=<>!&|^%~]+)\s*\("
    operator_conversion_regex = r"^@@.*@@[^=]*?\s*(?:public|private|protected|internal)?\s*static\s*(?P<fnc>implicit|explicit)\s*operator\s+\w+\s*\("

    # Property accessors (get/set)
    property_accessor_regex = r"^@@.*@@[^=]*?\s*(?P<fnc>get|set)\s*[{(]"

    # Expression-bodied methods and properties
    expression_bodied_method_regex = r"^@@.*@@[^=]*?\s*(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async)?\s*(?:async)?\s*(?:\w+\??(?:<[^>]*>)?(?:\[\])?\s+)?(?P<fnc>\w+)\s*\([^)]*\)\s*=>"
    expression_bodied_property_regex = r"^@@.*@@[^=]*?\s*(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract)?\s*(?:\w+\??(?:<[^>]*>)?(?:\[\])?\s+)?(?P<fnc>\w+)\s*=>"

    # Local functions (no access modifiers) - exclude operator declarations
    local_function_regex = r"^@@.*@@(?!.*\boperator\b)[^=]*?\s*(?:static|async)?\s*(?:async)?\s*(?:\w+\??(?:<[^>]*>)?(?:\[\])?\s+)?(?P<fnc>\w+)(?:<[^>]*>)?\s*\([^)]*\)\s*$"

    regexes = [
        method_declaration_regex,
        constructor_regex,
        destructor_regex,
        operator_standard_regex,
        operator_conversion_regex,
        property_accessor_regex,
        expression_bodied_method_regex,
        expression_bodied_property_regex,
        local_function_regex,
    ]


class GoParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    function_prefix = "."

    r"""
    Type of function declaration                        Example
    Regular function:                                   func Hello(name string) string
    Function with multiple returns:                     func Hello(name string) (string, error)
    Method with receiver:                               func (r *Receiver) MethodName() error
    Method with value receiver:                         func (r Receiver) MethodName() error
    Anonymous function:                                 func() { ... }
    Function variable:                                  var myFunc = func() { ... }
    Function variable (short declaration):              myFunc := func() { ... }
    Function variable separate assignment:              add = func(x, y int) int { ... }
    Interface method (in interface definition):         MethodName(param Type) ReturnType
    """

    # Regular function declarations (including generics with optional whitespace)
    function_declaration_regex = r"^@@.*@@[^=]*?\s*func\s+(?P<fnc>\w+)(?:\s*\[[^\]]*\])?\s*\("

    # Method declarations with receiver (pointer or value)
    method_with_receiver_regex = r"^@@.*@@[^=]*?\s*func\s+\([^)]+\)\s*(?P<fnc>\w+)\s*\("

    # Function variables with var keyword
    function_var_regex = r"^@@.*@@[^=]*?\s*var\s+(?P<fnc>\w+)\s*=\s*func\s*\("

    # Function variables with short declaration (:=)
    function_short_decl_regex = r"^@@.*@@[^=]*?\s*(?P<fnc>\w+)\s*:=\s*func\s*\("

    # Function variable separate assignment (handles var declaration then assignment)
    function_assignment_regex = r"^@@.*@@[^=]*?\s*(?P<fnc>\w+)\s*=\s*func\s*\("

    # Interface method declarations (no func keyword, just method signature)
    # This matches lines that look like method signatures in interfaces
    interface_method_regex = r"^@@.*@@(?!.*\bfunc\b)\s+(?P<fnc>\w+)\s*\([^)]*\).*$"

    regexes = [
        function_declaration_regex,
        method_with_receiver_regex,
        function_var_regex,
        function_short_decl_regex,
        function_assignment_regex,
        interface_method_regex,
        # Note: anonymous_function_regex omitted as it doesn't capture meaningful names
    ]


PATCH_PARSERS: dict[str, type[SimpleLanguageParser] | type[LanguageParser]] = {
    "py": PythonParser,
    "js": JavascriptParser,
    "jsx": JavascriptParser,
    "ts": JavascriptParser,
    "tsx": JavascriptParser,
    "php": PHPParser,
    "rb": RubyParser,
}


def get_patch_parsers_for_organization(
    organization: Organization | RpcOrganization | None = None,
) -> dict[str, type[SimpleLanguageParser] | type[LanguageParser]]:
    """
    Returns the appropriate patch parsers based on feature flags.
    Falls back to the standard parsers if no organization is provided.
    """
    parsers = PATCH_PARSERS
    if organization and features.has("organizations:csharp-open-pr-comments", organization):
        parsers.update({"cs": CSharpParser})
    if organization and features.has("organizations:go-open-pr-comments", organization):
        parsers.update({"go": GoParser})

    return parsers
