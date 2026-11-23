export function getFields(rawFields: readonly string[]): string[] | null {
  const fields = rawFields.filter(Boolean);

  if (fields.length) {
    return fields;
  }

  return null;
}
