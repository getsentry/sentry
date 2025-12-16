import type { SgRoot, SgNode, Edit } from "@codemod.com/jssg-types/main";
import type TSX from "codemod:ast-grep/langs/tsx";
import { parse } from "codemod:ast-grep";

// Map CSS flex properties to Flex/Stack component props
const FLEX_PROP_MAP: Record<string, string> = {
  "justify-content": "justify",
  "align-items": "align",
  "flex-direction": "direction",
  "flex-wrap": "wrap",
  gap: "gap",
};

// Flex/Stack component supported CSS properties
const FLEX_SUPPORTED_PROPS = new Set([
  "display",
  "justify-content",
  "align-items",
  "flex-direction",
  "flex-wrap",
  "gap",
]);

interface CSSProperty {
  property: string;
  value: string;
}

interface FlexProps {
  direction?: string;
  justify?: string;
  align?: string;
  wrap?: string;
  gap?: string;
  hasUnsupportedProps: boolean;
}

/**
 * Parse CSS string and extract properties
 */
function parseCSSProperties(cssText: string): CSSProperty[] {
  const properties: CSSProperty[] = [];

  try {
    // Parse CSS using ast-grep
    const cssRoot = parse("css", cssText);
    const cssRootNode = cssRoot.root();

    // Find all CSS declarations
    const declarations = cssRootNode.findAll({
      rule: { kind: "declaration" },
    });

    for (const decl of declarations) {
      const propertyNode = decl.find({ rule: { kind: "property_name" } });

      if (!propertyNode) continue;

      // Get value - could be plain_value, integer_value, or other value types
      // We'll get all children after the colon and before the semicolon
      const children = decl.children();
      let valueStarted = false;
      const valueTokens: string[] = [];

      for (const child of children) {
        if (child.text() === ":") {
          valueStarted = true;
          continue;
        }
        if (child.text() === ";") {
          break;
        }
        if (valueStarted && child.text().trim()) {
          valueTokens.push(child.text().trim());
        }
      }

      if (valueTokens.length > 0) {
        const property = propertyNode.text().trim();
        const value = valueTokens.join(" ");
        properties.push({ property, value });
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
  // Check if argument is an identifier (component reference) not a string
  return styledArg.is("identifier");
}

/**
 * Extract flex properties from CSS and determine if conversion is possible
 */
function extractFlexProps(cssText: string): FlexProps | null {
  const properties = parseCSSProperties(cssText);

  if (properties.length === 0) {
    return null;
  }

  // Check if display: flex is present
  const hasDisplayFlex = properties.some(
    p => p.property === "display" && p.value === "flex"
  );

  if (!hasDisplayFlex) {
    return null;
  }

  // Check for unsupported properties
  const hasUnsupportedProps = properties.some(
    p => !FLEX_SUPPORTED_PROPS.has(p.property)
  );

  if (hasUnsupportedProps) {
    return { hasUnsupportedProps: true };
  }

  // Extract flex properties
  const flexProps: FlexProps = { hasUnsupportedProps: false };

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
    "flex-start": "start",
    "flex-end": "end",
    center: "center",
    "space-between": "space-between",
    "space-around": "space-around",
    "space-evenly": "space-evenly",
    stretch: "stretch",
    baseline: "baseline",
    row: "row",
    column: "column",
    wrap: "wrap",
    nowrap: "nowrap",
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

  if (flexProps.direction && flexProps.direction !== "row") {
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

  return props.join(" ");
}

/**
 * Get or add import for Flex/Stack component
 */
function ensureImport(
  rootNode: SgNode<TSX>,
  componentName: "Flex" | "Stack"
): Edit | null {
  // Check if import already exists
  const existingImport = rootNode.find({
    rule: {
      kind: "import_statement",
      has: {
        field: "source",
        regex: "@sentry/scraps/layout",
      },
    },
  });

  if (existingImport) {
    // Check if componentName is already imported
    const hasComponent = existingImport.has({
      rule: {
        kind: "import_specifier",
        has: {
          field: "name",
          regex: `^${componentName}$`,
        },
      },
    });

    if (hasComponent) {
      return null;
    }

    // Add to existing import
    const namedImports = existingImport.find({
      rule: { kind: "named_imports" },
    });

    if (namedImports) {
      const closeBrace = namedImports.find({
        rule: { kind: "}" },
      });

      if (closeBrace) {
        return {
          startPos: closeBrace.range().start.index,
          endPos: closeBrace.range().start.index,
          insertedText: `, ${componentName}`,
        };
      }
    }
  }

  // Add new import at the top
  const firstImport = rootNode.find({
    rule: { kind: "import_statement" },
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
  const importsToAdd = new Set<"Flex" | "Stack">();

  // Find all styled component declarations
  const styledCalls = rootNode.findAll({
    rule: {
      kind: "call_expression",
      has: {
        field: "function",
        any: [
          {
            kind: "call_expression",
            has: {
              field: "function",
              kind: "identifier",
              regex: "^styled$",
            },
          },
          {
            kind: "identifier",
            regex: "^styled$",
          },
        ],
      },
    },
  });

  for (const styledCall of styledCalls) {
    // Get the styled() function call
    const styledFunc = styledCall.find({
      rule: {
        kind: "call_expression",
        has: {
          field: "function",
          kind: "identifier",
          regex: "^styled$",
        },
      },
    });

    if (!styledFunc) continue;

    // Get the first argument (element or component)
    const args = styledFunc.find({ rule: { kind: "arguments" } });
    if (!args) continue;

    const firstArg = args.child(1); // Skip opening paren
    if (!firstArg) continue;

    // Bailout if wrapping an existing component
    if (isWrappingComponent(firstArg)) {
      continue;
    }

    // Get the element name from string
    let elementName = "div";
    if (firstArg.is("string")) {
      const stringContent = firstArg.find({
        rule: { kind: "string_fragment" },
      });
      if (stringContent) {
        elementName = stringContent.text();
      }
    }

    // Get the template string with CSS
    const templateString = styledCall.find({
      rule: { kind: "template_string" },
    });

    if (!templateString) continue;

    // Extract CSS text
    const cssFragments = templateString.findAll({
      rule: { kind: "string_fragment" },
    });

    if (cssFragments.length === 0) continue;

    const cssText = cssFragments.map(f => f.text()).join("");

    // Parse CSS and extract flex properties
    const flexProps = extractFlexProps(cssText);

    if (!flexProps || flexProps.hasUnsupportedProps) {
      continue;
    }

    // Determine component type (Flex or Stack)
    const isColumn = flexProps.direction === "column";
    const componentName = isColumn ? "Stack" : "Flex";
    importsToAdd.add(componentName);

    // Build props string
    const asAttr = elementName !== "div" ? elementName : undefined;
    const propsStr = buildPropsString(flexProps, asAttr);

    // Replace the styled call with component
    const replacement = propsStr ? `<${componentName} ${propsStr}>` : `<${componentName}>`;

    // Find the lexical declaration (const/let/var) to replace the entire statement
    const lexicalDecl = styledCall.ancestors().find(a =>
      a.is("lexical_declaration")
    );

    if (lexicalDecl) {
      const varDeclarator = lexicalDecl.find({
        rule: { kind: "variable_declarator" },
      });

      if (varDeclarator) {
        const componentNameNode = varDeclarator.find({
          rule: { kind: "identifier" },
        });

        if (componentNameNode) {
          const oldComponentName = componentNameNode.text();

          // Replace the entire declaration with a comment
          edits.push(lexicalDecl.replace(`// TODO: Convert ${oldComponentName} usages to ${replacement}`));
        }
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
