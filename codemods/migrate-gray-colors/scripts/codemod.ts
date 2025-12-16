import type {Edit, SgNode, SgRoot} from '@codemod.com/jssg-types/main';
import type TSX from 'codemod:ast-grep/langs/tsx';

/**
 * Mapping from legacy gray colors to new colors structure
 * Based on the deprecatedColorMappings in theme.tsx:
 * - gray500 -> colors.gray800
 * - gray400 -> colors.gray500
 * - gray300 -> colors.gray400
 * - gray200 -> colors.gray200
 * - gray100 -> colors.gray100
 * - translucentGray200 -> colors.gray200
 * - translucentGray100 -> colors.gray100
 */
const GRAY_COLOR_MAPPING: Record<string, string> = {
  gray500: 'gray800',
  gray400: 'gray500',
  gray300: 'gray400',
  gray200: 'gray200',
  gray100: 'gray100',
  translucentGray200: 'gray200',
  translucentGray100: 'gray100',
};

/**
 * Check if a node represents access to theme (e.g., theme, p.theme, props.theme)
 */
function isThemeAccess(node: SgNode<TSX>): boolean {
  if (node.is('identifier')) {
    return node.text() === 'theme';
  }

  if (node.is('member_expression')) {
    const property = node.field('property');
    if (property && property.text() === 'theme') {
      return true;
    }
  }

  return false;
}

/**
 * Extract the base theme expression (e.g., "theme", "p.theme", "props.theme")
 */
function getThemeBase(memberExpr: SgNode<TSX>): string {
  const object = memberExpr.field('object');
  if (!object) return 'theme';

  return object.text();
}

/**
 * Main transformation function
 */
async function transform(root: SgRoot<TSX>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  // Find all member expressions accessing gray colors on theme
  // Pattern: theme.grayXXX or p.theme.grayXXX or props.theme.grayXXX
  const matches = rootNode.findAll({
    rule: {
      kind: 'member_expression',
      all: [
        {
          has: {
            field: 'property',
            kind: 'property_identifier',
            any: Object.keys(GRAY_COLOR_MAPPING).map(colorName => ({
              regex: `^${colorName}$`,
            })),
          },
        },
        {
          has: {
            field: 'object',
            any: [
              // Direct theme access: theme.grayXXX
              {kind: 'identifier', regex: '^theme$'},
              // Nested theme access: p.theme.grayXXX or props.theme.grayXXX
              {
                kind: 'member_expression',
                has: {
                  field: 'property',
                  kind: 'property_identifier',
                  regex: '^theme$',
                },
              },
            ],
          },
        },
      ],
    },
  });

  for (const match of matches) {
    const object = match.field('object');
    const property = match.field('property');

    if (!object || !property) continue;

    // Verify this is indeed a theme access
    if (!isThemeAccess(object)) continue;

    const colorName = property.text();
    const newColorName = GRAY_COLOR_MAPPING[colorName];

    if (!newColorName) continue;

    // Get the base theme expression
    const themeBase = getThemeBase(match);

    // Transform: theme.gray300 -> theme.colors.gray400
    const replacement = `${themeBase}.colors.${newColorName}`;

    edits.push(match.replace(replacement));
  }

  if (edits.length === 0) {
    return null;
  }

  return rootNode.commitEdits(edits);
}

export default transform;
