export function isUUID(uuid: string): boolean {
  const uuidRegex = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  return uuidRegex.test(uuid);
}
