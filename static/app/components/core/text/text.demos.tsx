/**
 * Shared demo components for text .mdx documentation and .snapshots.tsx tests.
 */
import {Fragment} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text, type TextProps} from '@sentry/scraps/text';

import type {TextSize} from 'sentry/utils/theme';

// === Sizes ===

export const sizes: TextSize[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

const sizeLabels: Record<TextSize, string> = {
  xs: 'Extra small text',
  sm: 'Small text',
  md: 'Medium text (default)',
  lg: 'Large text',
  xl: 'Extra large text',
  '2xl': 'Extra extra large text',
};

export function SizeDemo({size}: {size: TextSize}) {
  return <Text size={size}>{sizeLabels[size]}</Text>;
}

// === Variants ===

type TextVariant = NonNullable<TextProps<'span'>['variant']>;

export const variants: TextVariant[] = [
  'primary',
  'muted',
  'accent',
  'success',
  'warning',
  'danger',
  'promotion',
];

const variantLabels: Partial<Record<TextVariant, string>> = {
  primary: 'Primary text (default)',
  secondary: 'Secondary text',
  muted: 'Muted text',
  accent: 'Accent text',
  success: 'Success text',
  warning: 'Warning text',
  danger: 'Danger text',
  promotion: 'Promotion text',
};

export function VariantDemo({variant}: {variant: TextVariant}) {
  return <Text variant={variant}>{variantLabels[variant]}</Text>;
}

// === Custom Elements (as prop) ===

export const elements = ['p', 'span', 'div'] as const;

export function ElementDemo({as}: {as: (typeof elements)[number]}) {
  return <Text as={as}>Text rendered as a {as} element</Text>;
}

// === Typography features ===

export const typographyFeatures = [
  {name: 'bold', render: () => <Text bold>Bold text</Text>},
  {name: 'italic', render: () => <Text italic>Italic text</Text>},
  {name: 'underline', render: () => <Text underline>Underlined text</Text>},
  {
    name: 'underline-dotted',
    render: () => <Text underline="dotted">Dotted underlined text</Text>,
  },
  {
    name: 'strikethrough',
    render: () => <Text strikethrough>Strikethrough text</Text>,
  },
  {
    name: 'bold-italic-underline',
    render: () => (
      <Text bold italic underline>
        Bold italic underlined text
      </Text>
    ),
  },
];

// === Links ===

export function LinkDemo() {
  return (
    <Container padding="md">
      <Text>
        This is a paragraph with an{' '}
        <Link to="/organizations/sentry/issues/">inline link</Link> that inherits text
        styling.
      </Text>
    </Container>
  );
}

// === Text Alignment ===

export const alignments = ['left', 'center', 'right', 'justify'] as const;

export function AlignmentDemo({align}: {align: (typeof alignments)[number]}) {
  const label =
    align === 'justify'
      ? 'Justified text that will wrap to multiple lines and be justified.'
      : `${align.charAt(0).toUpperCase() + align.slice(1)} aligned text`;
  return (
    <Container width="200px" padding="md" border="primary">
      <Text align={align}>{label}</Text>
    </Container>
  );
}

// === Density ===

export const densityConfigs = [
  {name: 'compressed', density: 'compressed' as const, label: 'Compressed'},
  {name: 'default', density: undefined, label: 'Default'},
  {name: 'comfortable', density: 'comfortable' as const, label: 'Comfortable'},
];

export function DensityDemo({
  density,
  label,
}: {
  label: string;
  density?: 'compressed' | 'comfortable';
}) {
  return (
    <Container>
      <Heading as="h4">{label} density</Heading>
      <Text as="p" density={density}>
        {label} density text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
        do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </Text>
    </Container>
  );
}

// === Ellipsis Overflow ===

export function EllipsisDemo() {
  return (
    <Container width="200px" padding="md" border="primary">
      <Text ellipsis>
        This is a very long text that will be truncated with an ellipsis
      </Text>
    </Container>
  );
}

// === Wrapping ===

export function WordBreakDemo() {
  return (
    <Container width="200px" padding="md" border="primary">
      <Text wordBreak="break-word">
        A URL string that breaks on word boundaries:
        https://example.com/path/?marketingParam1=value1&marketingParam2=some-awkward-long-value
      </Text>
    </Container>
  );
}

export function WrapBalanceDemo() {
  return (
    <Container width="200px" padding="md" border="primary">
      <Text textWrap="balance">
        Balanced text wrapping for a string of words of varying lengths
      </Text>
    </Container>
  );
}

// === Monospace ===

export function MonospaceComparisonDemo() {
  return (
    <Fragment>
      <Flex align="center" gap="xl" marginBottom="2xl">
        <Text>1234567890</Text>
        <Text size="sm" variant="muted">
          Regular
        </Text>
      </Flex>
      <Flex align="center" gap="xl">
        <Text monospace>1234567890</Text>
        <Text size="sm" variant="muted">
          Monospace
        </Text>
      </Flex>
    </Fragment>
  );
}

// === Font Features ===

export function TabularComparisonDemo() {
  return (
    <Fragment>
      <Flex align="center" gap="xl" marginBottom="2xl">
        <Text>1234567890</Text>
        <Text size="sm" variant="muted">
          Regular numbers
        </Text>
      </Flex>
      <Flex align="center" gap="xl">
        <Text tabular>1234567890</Text>
        <Text size="sm" variant="muted">
          Tabular numbers
        </Text>
      </Flex>
    </Fragment>
  );
}

export function FractionComparisonDemo() {
  return (
    <Fragment>
      <Flex align="center" gap="xl" marginBottom="2xl">
        <Text>1/2 3/4 5/8</Text>
        <Text size="sm" variant="muted">
          Regular fractions
        </Text>
      </Flex>
      <Flex align="center" gap="xl">
        <Text fraction>1/2 3/4 5/8</Text>
        <Text size="sm" variant="muted">
          Diagonal fractions
        </Text>
      </Flex>
    </Fragment>
  );
}

// === Responsive Sizes ===

export function ResponsiveDemo() {
  return (
    <Container width="200px" border="primary">
      <Text
        size={{xs: 'xs', sm: 'sm', md: 'md', lg: 'lg', xl: 'xl'}}
        align={{xs: 'left', sm: 'center', md: 'right', lg: 'justify', xl: 'left'}}
      >
        Responsive text
      </Text>
    </Container>
  );
}
