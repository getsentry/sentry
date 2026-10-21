import {DescriptionList} from '@sentry/scraps/descriptionList';
import {InfoText} from '@sentry/scraps/info';
import {Container, Stack, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {BaseLayout, LayoutLabel} from './layout/base';
import {useStackedLayout} from './layout/useStackedLayout';

interface DisplayFieldProps {
  children: React.ReactNode;
  label: React.ReactNode;
  hintText?: React.ReactNode;
  padding?: ContainerProps['padding'];
  variant?: 'compact';
}

function RowDisplay(props: DisplayFieldProps) {
  const stacked = useStackedLayout();
  return <DisplayLayout {...props} stacked={stacked} />;
}

function StackDisplay(props: DisplayFieldProps) {
  return <DisplayLayout {...props} stacked />;
}

function DisplayLayout({
  children,
  label,
  hintText,
  padding,
  variant,
  stacked,
}: DisplayFieldProps & {stacked: boolean}) {
  const compact = variant === 'compact';

  const hint =
    hintText && !compact ? (
      <Text size="sm" variant="muted">
        {hintText}
      </Text>
    ) : null;

  return (
    <BaseLayout as="dl" stacked={stacked} padding={padding} margin="0">
      <LayoutLabel stacked={stacked}>
        {labelProps => (
          <DescriptionList.Term {...labelProps}>
            <Text>
              {compact && hintText ? (
                <InfoText title={hintText}>{label}</InfoText>
              ) : (
                label
              )}
            </Text>
            {!stacked && hint}
          </DescriptionList.Term>
        )}
      </LayoutLabel>
      <Container flexGrow={1}>
        {valueProps => (
          <DescriptionList.Details {...valueProps}>
            <Stack gap="md">
              {children}
              {stacked && hint}
            </Stack>
          </DescriptionList.Details>
        )}
      </Container>
    </BaseLayout>
  );
}

/** Display information with the same layout as form fields, without form state. */
export const DisplayField = {Row: RowDisplay, Stack: StackDisplay};
