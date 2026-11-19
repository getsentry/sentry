/** The span attribute that holds a tool call's output. */
export const TOOL_CALL_RESULT_ATTRIBUTE = 'gen_ai.tool.call.result';
/** The older attribute some SDKs still report a tool call's output in. */
export const LEGACY_TOOL_OUTPUT_ATTRIBUTE = 'gen_ai.tool.output';

type AttributeGetter = (key: string) => string | number | boolean | null | undefined;

/**
 * Returns a tool call's raw output: the current attribute, falling back to the
 * legacy one for spans that only report that.
 */
export function getRawToolOutput(getAttribute: AttributeGetter) {
  return [TOOL_CALL_RESULT_ATTRIBUTE, LEGACY_TOOL_OUTPUT_ATTRIBUTE]
    .map(key => getAttribute(key))
    .find(
      (value): value is string | number | boolean => value !== undefined && value !== null
    );
}
