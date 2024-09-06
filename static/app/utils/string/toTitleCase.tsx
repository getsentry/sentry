interface TitleCaseOptions {
  /**
   * If true, will allow capital letters in the middle of words.
   * E.g. 'my testCase' -> 'My TestCase'
   */
  allowInnerUpperCase?: boolean;
}

export function toTitleCase(str: string, opts?: TitleCaseOptions): string {
  return str.replace(/\w\S*/g, txt =>
    opts?.allowInnerUpperCase
      ? txt.charAt(0).toUpperCase() + txt.substring(1)
      : txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}
