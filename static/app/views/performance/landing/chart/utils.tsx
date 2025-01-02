export function getFieldOrBackup(field: string, backupField?: string) {
  return backupField ?? field;
}
