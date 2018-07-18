/* global process */

// Return a specified "fixed" string when we are in a testing environment
// (more specifically in a PERCY env (e.g. CI))
export default function getDynamicText({value, fixed}) {
  return process.env.IS_PERCY ? fixed : value;
}
