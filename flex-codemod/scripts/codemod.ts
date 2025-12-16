import type {Edit, SgNode, SgRoot} from '@codemod.com/jssg-types/main';
import {parse} from 'codemod:ast-grep';
import type TSX from 'codemod:ast-grep/langs/tsx';

// Map CSS flex properties to Flex/Stack component props
const FLEX_PROP_MAP: Record<string, string> = {
  'justify-content': 'justify',
  'align-items': 'align',
  'flex-direction': 'direction',
  'flex-wrap': 'wrap',
  gap: 'gap',
};

// Flex/Stack component supported CSS properties
const FLEX_SUPPORTED_PROPS = new Set([
  'display',
  'justify-content',
  'align-items',
  'flex-direction',
  'flex-wrap',
  'gap',
]);

interface CSSProperty {
  property: string;
  value: string;
}

interface FlexProps {
  hasUnsupportedProps: boolean;
  align?: string;
  direction?: string;
  gap?: string;
  justify?: string;
  wrap?: string;
}

/**
 * Extract space/gap value from template substitution
 */
function extractSpaceValue(templateSub: SgNode<TSX>): string | null {
  const subText = templateSub.text();

  // Match patterns like ${space(2)} or ${p => p.theme.space[2]}
  // Extract the numeric value
  const spaceMatch = subText.match(/space\[(\d+(?:\.\d+)?)\]|space\((\d+(?:\.\d+)?)\)/);
  if (spaceMatch) {
    const value = spaceMatch[1] || spaceMatch[2];
    return value;
  }

  return null;
}

/**
 * Map numeric space values to t-shirt sizes
 */
function mapSpaceToSize(spaceValue: string): string {
  const sizeMap: Record<string, string> = {
    '0': 'none',
    '0.25': 'xxs',
    '0.5': 'xs',
    '1': 'sm',
    '1.5': 'md',
    '2': 'lg',
    '2.5': 'xl',
    '3': 'xxl',
    '4': 'xxxl',
  };

  return sizeMap[spaceValue] || spaceValue;
}

/**
 * Map pixel values to t-shirt sizes (common Sentry spacing values)
 */
function mapPixelsToSize(pixels: string): string {
  const pxValue = pixels.replace('px', '').trim();
  const pxMap: Record<string, string> = {
    '0': 'none',
    '2': 'xxs',
    '4': 'xs',
    '8': 'sm',
    '12': 'md',
    '16': 'lg',
    '20': 'xl',
    '24': 'xxl',
    '32': 'xxxl',
  };

  return pxMap[pxValue] || pixels;
}

/**
 * Build CSS text with template substitutions replaced by extracted values
 */
function buildCSSWithSubstitutions(templateString: SgNode<TSX>): string {
  let cssText = '';
  const children = templateString.children();

  for (const child of children) {
    const childKind = child.kind();

    if (childKind === 'string_fragment') {
      cssText += child.text();
    } else if (childKind === 'template_substitution') {
      const spaceValue = extractSpaceValue(child);
      if (spaceValue) {
        const sizeValue = mapSpaceToSize(spaceValue);
        cssText += sizeValue;
      } else {
        // Unknown template substitution, use placeholder
        cssText += '__TEMPLATE__';
      }
    } else if (childKind === '`') {
      // Skip backticks
      continue;
    }
  }

  return cssText;
}

/**
 * Parse CSS string and extract properties, handling template substitutions
 */
function parseCSSProperties(
  cssText: string,
  templateString?: SgNode<TSX>
): CSSProperty[] {
  const properties: CSSProperty[] = [];

  // If we have a template string with substitutions, rebuild the CSS text
  if (templateString) {
    const hasSubstitutions = templateString.has({
      rule: {kind: 'template_substitution'},
    });

    if (hasSubstitutions) {
      cssText = buildCSSWithSubstitutions(templateString);

      // If we still have unresolved templates, bail out
      if (cssText.includes('__TEMPLATE__')) {
        return [];
      }
    }
  }

  try {
    // Parse CSS using ast-grep
    const cssRoot = parse('css', cssText);
    const cssRootNode = cssRoot.root();

    // Find all CSS declarations
    const declarations = cssRootNode.findAll({
      rule: {kind: 'declaration'},
    });

    for (const decl of declarations) {
      const propertyNode = decl.find({rule: {kind: 'property_name'}});

      if (!propertyNode) continue;

      // Get value - could be plain_value, integer_value, or other value types
      // We'll get all children after the colon and before the semicolon
      const children = decl.children();
      let valueStarted = false;
      const valueTokens: string[] = [];

      for (const child of children) {
        if (child.text() === ':') {
          valueStarted = true;
          continue;
        }
        if (child.text() === ';') {
          break;
        }
        if (valueStarted && child.text().trim()) {
          valueTokens.push(child.text().trim());
        }
      }

      if (valueTokens.length > 0) {
        const property = propertyNode.text().trim();
        let value = valueTokens.join(' ');

        // Map pixel values to sizes for gap
        if (property === 'gap' && value.includes('px')) {
          value = mapPixelsToSize(value);
        }

        properties.push({property, value});
      }
    }
  } catch (e) {
    // If CSS parsing fails, bailout
    return [];
  }

  return properties;
}

/**
 * Check if a styled component call wraps an existing component
 */
function isWrappingComponent(styledArg: SgNode<TSX>): boolean {
  // Check if argument is an identifier (component reference) or instantiation_expression (generic component)
  // Examples: styled(Component) or styled(Component<Type>)
  return styledArg.is('identifier') || styledArg.is('instantiation_expression');
}

/**
 * Extract flex properties from CSS and determine if conversion is possible
 */
function extractFlexProps(
  cssText: string,
  templateString?: SgNode<TSX>
): FlexProps | null {
  const properties = parseCSSProperties(cssText, templateString);

  if (properties.length === 0) {
    return null;
  }

  // Check if display: flex is present
  const hasDisplayFlex = properties.some(
    p => p.property === 'display' && p.value === 'flex'
  );

  if (!hasDisplayFlex) {
    return null;
  }

  // Check for unsupported properties
  const hasUnsupportedProps = properties.some(p => !FLEX_SUPPORTED_PROPS.has(p.property));

  if (hasUnsupportedProps) {
    return {hasUnsupportedProps: true};
  }

  // Extract flex properties
  const flexProps: FlexProps = {hasUnsupportedProps: false};

  for (const prop of properties) {
    if (FLEX_PROP_MAP[prop.property]) {
      const mappedProp = FLEX_PROP_MAP[prop.property];
      flexProps[mappedProp as keyof FlexProps] = prop.value;
    }
  }

  return flexProps;
}

/**
 * Convert CSS value to component prop value
 */
function convertPropValue(cssValue: string): string {
  // Map common CSS values to component prop values
  const valueMap: Record<string, string> = {
    'flex-start': 'start',
    'flex-end': 'end',
    center: 'center',
    'space-between': 'space-between',
    'space-around': 'space-around',
    'space-evenly': 'space-evenly',
    stretch: 'stretch',
    baseline: 'baseline',
    row: 'row',
    column: 'column',
    wrap: 'wrap',
    nowrap: 'nowrap',
  };

  return valueMap[cssValue] || cssValue;
}

/**
 * Build component props string from flex properties
 */
function buildPropsString(flexProps: FlexProps, as?: string): string {
  const props: string[] = [];

  if (as) {
    props.push(`as="${as}"`);
  }

  if (flexProps.direction && flexProps.direction !== 'row') {
    const dirValue = convertPropValue(flexProps.direction);
    props.push(`direction="${dirValue}"`);
  }

  if (flexProps.justify) {
    const justifyValue = convertPropValue(flexProps.justify);
    props.push(`justify="${justifyValue}"`);
  }

  if (flexProps.align) {
    const alignValue = convertPropValue(flexProps.align);
    props.push(`align="${alignValue}"`);
  }

  if (flexProps.wrap) {
    const wrapValue = convertPropValue(flexProps.wrap);
    props.push(`wrap="${wrapValue}"`);
  }

  if (flexProps.gap) {
    props.push(`gap="${flexProps.gap}"`);
  }

  return props.join(' ');
}

/**
 * Get or add import for Flex/Stack component
 */
function ensureImport(
  rootNode: SgNode<TSX>,
  componentName: 'Flex' | 'Stack'
): Edit | null {
  // Find all import statements and check if one imports from @sentry/scraps/layout
  const allImports = rootNode.findAll({
    rule: {kind: 'import_statement'},
  });

  let existingImport: SgNode<TSX> | null = null;

  for (const importStmt of allImports) {
    const importText = importStmt.text();
    if (importText.includes('@sentry/scraps/layout')) {
      existingImport = importStmt;
      break;
    }
  }

  if (existingImport) {
    // Check if componentName is already imported
    const importText = existingImport.text();
    if (importText.includes(componentName)) {
      return null;
    }

    // Add to existing import
    const namedImports = existingImport.find({
      rule: {kind: 'named_imports'},
    });

    if (namedImports) {
      // Find the last import specifier to add after it
      const lastSpecifier = namedImports
        .findAll({
          rule: {kind: 'import_specifier'},
        })
        .pop();

      if (lastSpecifier) {
        return {
          startPos: lastSpecifier.range().end.index,
          endPos: lastSpecifier.range().end.index,
          insertedText: `, ${componentName}`,
        };
      }
    }
  }

  // Add new import at the top
  const firstImport = rootNode.find({
    rule: {kind: 'import_statement'},
  });

  const importStatement = `import {${componentName}} from '@sentry/scraps/layout';\n`;

  if (firstImport) {
    return {
      startPos: firstImport.range().start.index,
      endPos: firstImport.range().start.index,
      insertedText: importStatement,
    };
  }

  // No imports exist, add at the start
  return {
    startPos: 0,
    endPos: 0,
    insertedText: importStatement,
  };
}

const transform = async (root: SgRoot<TSX>): Promise<string | null> => {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const importsToAdd = new Set<'Flex' | 'Stack'>();
  const componentsToReplace = new Map<
    string,
    {componentName: 'Flex' | 'Stack'; propsStr: string}
  >();
  const exportedComponents = new Set<string>();
  const fileName = root.filename();

  // Find all styled component declarations
  const styledCalls = rootNode.findAll({
    rule: {
      kind: 'call_expression',
      has: {
        field: 'function',
        any: [
          {
            kind: 'call_expression',
            has: {
              field: 'function',
              kind: 'identifier',
              regex: '^styled$',
            },
          },
          {
            kind: 'identifier',
            regex: '^styled$',
          },
        ],
      },
    },
  });

  for (const styledCall of styledCalls) {
    // Get the styled() function call
    const styledFunc = styledCall.find({
      rule: {
        kind: 'call_expression',
        has: {
          field: 'function',
          kind: 'identifier',
          regex: '^styled$',
        },
      },
    });

    if (!styledFunc) continue;

    // Get the first argument (element or component)
    const args = styledFunc.find({rule: {kind: 'arguments'}});
    if (!args) continue;

    const firstArg = args.child(1); // Skip opening paren
    if (!firstArg) continue;

    // Get the element name from string
    let elementName = 'div';
    if (firstArg.is('string')) {
      const stringContent = firstArg.find({
        rule: {kind: 'string_fragment'},
      });
      if (stringContent) {
        elementName = stringContent.text();
      }
    }

    // Get the template string with CSS
    const templateString = styledCall.find({
      rule: {kind: 'template_string'},
    });

    if (!templateString) continue;

    // Extract CSS text
    const cssFragments = templateString.findAll({
      rule: {kind: 'string_fragment'},
    });

    if (cssFragments.length === 0) continue;

    const cssText = cssFragments.map(f => f.text()).join('');

    // Parse CSS and extract flex properties
    const flexProps = extractFlexProps(cssText, templateString);

    // Not a viable candidate if it doesn't have display: flex - skip silently
    if (!flexProps) {
      continue;
    }

    // Get component name for logging
    const componentNameNode = styledCall
      .ancestors()
      .find(a => a.is('variable_declarator'))
      ?.find({
        rule: {kind: 'identifier'},
      });
    const oldComponentName = componentNameNode?.text() || 'unknown';
    const lineNumber = styledCall.range().start.line;

    // Check if this is an export statement
    const exportStmt = styledCall.ancestors().find(a => a.is('export_statement'));
    const isExported = !!exportStmt;

    // Now check bailout conditions for viable candidates (has display: flex)

    // Bailout if wrapping an existing component
    if (isWrappingComponent(firstArg)) {
      console.log(
        `[BAILOUT] ${fileName}:${lineNumber} - "${oldComponentName}" wraps existing component`
      );
      continue;
    }

    // Bailout if has unsupported CSS properties
    if (flexProps.hasUnsupportedProps) {
      console.log(
        `[BAILOUT] ${fileName}:${lineNumber} - "${oldComponentName}" has unsupported CSS properties`
      );
      continue;
    }

    // Determine component type (Flex or Stack)
    const isColumn = flexProps.direction === 'column';
    const componentName = isColumn ? 'Stack' : 'Flex';
    importsToAdd.add(componentName);

    // Build props string
    const asAttr = elementName === 'div' ? undefined : elementName;
    const propsStr = buildPropsString(flexProps, asAttr);

    // Find the lexical declaration (const/let/var) to remove or transform it
    const lexicalDecl = styledCall.ancestors().find(a => a.is('lexical_declaration'));

    if (lexicalDecl) {
      const varDeclarator = lexicalDecl.find({
        rule: {kind: 'variable_declarator'},
      });

      if (varDeclarator) {
        const componentNameNode = varDeclarator.find({
          rule: {kind: 'identifier'},
        });

        if (componentNameNode) {
          const styledComponentName = componentNameNode.text();

          // Store component replacement info
          componentsToReplace.set(styledComponentName, {componentName, propsStr});

          if (isExported && exportStmt) {
            // For exported components, transform to an arrow function component
            const exportKeyword = exportStmt.text().startsWith('export const')
              ? 'export const'
              : 'export';
            const openingTag = propsStr
              ? `<${componentName} ${propsStr}>`
              : `<${componentName}>`;
            const closingTag = `</${componentName}>`;
            const replacement = `${exportKeyword} ${styledComponentName} = ({children}: {children?: React.ReactNode}) => (\n  ${openingTag}{children}${closingTag}\n);`;

            edits.push(exportStmt.replace(replacement));
            // Track that this component is exported so we don't replace its JSX usages
            exportedComponents.add(styledComponentName);
          } else {
            // For non-exported components, just remove the declaration
            edits.push(lexicalDecl.replace(''));
          }
        }
      }
    }
  }

  // Replace JSX usages of the styled components (but skip exported ones)
  for (const [oldName, {componentName, propsStr}] of componentsToReplace) {
    // Skip exported components - they're now arrow function components with the same name
    if (exportedComponents.has(oldName)) {
      continue;
    }

    // Find opening elements
    const openingElements = rootNode.findAll({
      rule: {
        kind: 'jsx_opening_element',
        has: {
          field: 'name',
          kind: 'identifier',
          regex: `^${oldName}$`,
        },
      },
    });

    for (const openingEl of openingElements) {
      const nameNode = openingEl.find({
        rule: {kind: 'identifier', regex: `^${oldName}$`},
      });

      if (nameNode) {
        const replacement = propsStr ? `${componentName} ${propsStr}` : componentName;
        edits.push(nameNode.replace(replacement));
      }
    }

    // Find self-closing elements
    const selfClosingElements = rootNode.findAll({
      rule: {
        kind: 'jsx_self_closing_element',
        has: {
          field: 'name',
          kind: 'identifier',
          regex: `^${oldName}$`,
        },
      },
    });

    for (const selfClosingEl of selfClosingElements) {
      const nameNode = selfClosingEl.find({
        rule: {kind: 'identifier', regex: `^${oldName}$`},
      });

      if (nameNode) {
        const replacement = propsStr ? `${componentName} ${propsStr}` : componentName;
        edits.push(nameNode.replace(replacement));
      }
    }

    // Find closing elements
    const closingElements = rootNode.findAll({
      rule: {
        kind: 'jsx_closing_element',
        has: {
          field: 'name',
          kind: 'identifier',
          regex: `^${oldName}$`,
        },
      },
    });

    for (const closingEl of closingElements) {
      const nameNode = closingEl.find({
        rule: {kind: 'identifier', regex: `^${oldName}$`},
      });

      if (nameNode) {
        edits.push(nameNode.replace(componentName));
      }
    }
  }

  // Add imports
  for (const componentName of importsToAdd) {
    const importEdit = ensureImport(rootNode, componentName);
    if (importEdit) {
      edits.push(importEdit);
    }
  }

  if (edits.length === 0) {
    return null;
  }

  return rootNode.commitEdits(edits);
};

export default transform;
