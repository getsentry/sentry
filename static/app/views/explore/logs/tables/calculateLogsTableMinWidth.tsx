const MIN_WIDTH_BASE_PX = 256;
const MIN_WIDTH_PER_FIELD_PX = 64;

export function calculateLogsTableMinWidth(fields: number) {
  return `${MIN_WIDTH_BASE_PX + (fields + 1) * MIN_WIDTH_PER_FIELD_PX}px`;
}
