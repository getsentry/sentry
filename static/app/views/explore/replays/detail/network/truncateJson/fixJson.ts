import {completeJson} from './completeJson';
import {evaluateJson} from './evaluateJson';

/**
 * Takes an incomplete JSON string, and returns a hopefully valid JSON string.
 * Note that this _can_ fail, so you should check the return value is valid JSON.
 */
export function fixJson(incompleteJson: string): string {
  const stack = evaluateJson(incompleteJson);

  return completeJson(incompleteJson, stack);
}
