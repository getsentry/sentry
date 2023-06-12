import {PRODUCT} from 'sentry/components/onboarding/productSelection';

type Props = {
  activeProductSelection: PRODUCT[];
  children: React.ReactNode;
  products?: PRODUCT[];
};

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
