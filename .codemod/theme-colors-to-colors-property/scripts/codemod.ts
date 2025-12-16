import type {Edit, SgNode, SgRoot} from '@codemod.com/jssg-types/main';
import type TSX from 'codemod:ast-grep/langs/tsx';

/**
 * Mapping from deprecated theme properties to their correct values in theme.colors
 * Based on deprecatedColorMappings in static/app/utils/theme/theme.tsx
 *
 * IMPORTANT: Some properties map to DIFFERENT values!
 * For example: theme.gray500 → theme.colors.gray800 (NOT gray500!)
 */
const DEPRECATED_COLOR_MAPPING: Record<string, string> = {
  // Black and white
  black: 'black',
  white: 'white',
  lightModeBlack: 'black',
  lightModeWhite: 'white',

  // Surface colors (shifted mapping!)
  surface100: 'surface200',
  surface200: 'surface300',
  surface300: 'surface400',
  surface400: 'surface500',
  surface500: 'surface500',
  translucentSurface100: 'surface100',
  translucentSurface200: 'surface200',

  // Gray colors (shifted mapping!)
  gray500: 'gray800',
  gray400: 'gray500',
  gray300: 'gray400',
  gray200: 'gray200',
  gray100: 'gray100',
  translucentGray200: 'gray200',
  translucentGray100: 'gray100',

  // Purple → Blue mapping
  purple400: 'blue500',
  purple300: 'blue400',
  purple200: 'blue200',
  purple100: 'blue100',

  // Blue colors (shifted mapping!)
  blue400: 'blue500',
  blue300: 'blue400',
  blue200: 'blue200',
  blue100: 'blue100',

  // Pink colors (shifted mapping!)
  pink400: 'pink500',
  pink300: 'pink400',
  pink200: 'pink200',
  pink100: 'pink100',

  // Red colors (shifted mapping!)
  red400: 'red500',
  red300: 'red400',
  red200: 'red200',
  red100: 'red100',

  // Yellow colors (shifted mapping!)
  yellow400: 'yellow500',
  yellow300: 'yellow400',
  yellow200: 'yellow200',
  yellow100: 'yellow100',

  // Green colors (shifted mapping!)
  green400: 'green500',
  green300: 'green400',
  green200: 'green200',
  green100: 'green100',
};

/**
 * Check if a property name is a deprecated color that should be transformed
 */
function isDeprecatedColor(propertyName: string): boolean {
  return propertyName in DEPRECATED_COLOR_MAPPING;
}

/**
 * Get the correct color property name for theme.colors
 */
function getCorrectColorProperty(deprecatedName: string): string | null {
  return DEPRECATED_COLOR_MAPPING[deprecatedName] ?? null;
}

/**
 * Transform theme color references from theme.colorXXX to theme.colors.colorXXX
 * Skips string literals like "gray100"
 * Handles both direct access (theme.gray100) and nested access (p.theme.gray100)
 */
async function transform(root: SgRoot<TSX>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  // Find all member expressions
  const memberExpressions = rootNode.findAll({
    rule: {
      kind: 'member_expression',
    },
  });

  for (const node of memberExpressions) {
    // Get the property being accessed
    const propertyNode = node.field('property');
    if (!propertyNode) continue;

    const propertyName = propertyNode.text();

    // Check if this is a deprecated color property that needs transformation
    if (!isDeprecatedColor(propertyName)) continue;

    // Get the correct color property name
    const correctColorName = getCorrectColorProperty(propertyName);
    if (!correctColorName) continue;

    // Get the object part of the member expression
    const objectNode = node.field('object');
    if (!objectNode) continue;

    // Check if the object is "theme" (direct access: theme.gray100)
    // or if it's another member expression ending in "theme" (nested: p.theme.gray100)
    let isThemeAccess = false;

    if (objectNode.is('identifier') && objectNode.text() === 'theme') {
      // Direct access: theme.gray100
      isThemeAccess = true;
    } else if (objectNode.is('member_expression')) {
      // Nested access: check if it ends with .theme
      const nestedProperty = objectNode.field('property');
      if (nestedProperty && nestedProperty.text() === 'theme') {
        isThemeAccess = true;
      }
    }

    if (!isThemeAccess) continue;

    // Check if this is part of a larger member expression (e.g., theme.gray100.whatever)
    // In that case, we don't want to transform it
    const parent = node.parent();
    if (parent && parent.is('member_expression')) {
      // Check if our node is the object of the parent member expression
      const parentObject = parent.field('object');
      if (parentObject && parentObject.id() === node.id()) {
        continue; // Skip, it's part of a longer chain
      }
    }

    // Create the replacement using the CORRECT color name from the mapping
    // IMPORTANT: The deprecated name might map to a different color!
    // For example: theme.gray500 → theme.colors.gray800
    const objectText = objectNode.text();
    const replacement = `${objectText}.colors.${correctColorName}`;
    edits.push(node.replace(replacement));
  }

  // If no edits were made, return null
  if (edits.length === 0) {
    return null;
  }

  // Apply all edits and return the transformed code
  return rootNode.commitEdits(edits);
}

export default transform;
