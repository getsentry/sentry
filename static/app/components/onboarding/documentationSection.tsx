import {PRODUCT} from 'sentry/components/onboarding/productSelection';

type Props = {
  activeProductSelection: PRODUCT[];
  children: React.ReactNode;
  products?: PRODUCT[];
};

// It displays the content (children) if  "products" and "activeProductSelection" matches.
// The "activeProductSelection" comes from a URL parameter
export function DocumentationSection({
  children,
  activeProductSelection,
  products = [],
}: Props) {
  return activeProductSelection.length === products.length &&
    products.every(product => activeProductSelection.includes(product))
    ? children
    : null;
}
