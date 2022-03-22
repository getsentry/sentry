import {t} from 'sentry/locale';

function getTypeName(sourceType: TypeScriptTypes.TreeNode | undefined) {
  if (sourceType === undefined) {
    return t('unknown symbol');
  }

  return sourceType?.node.display || sourceType?.node.symbolName || t('unknown symbol');
}

export function formatTypeScriptTypeTooltip(
  sourceType: TypeScriptTypes.TreeNode | undefined,
  targetType: TypeScriptTypes.TreeNode | undefined
): string {
  return getTypeName(sourceType) + getTypeName(targetType);
}
