import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface DoDontProps {
  children: React.ReactNode;
}

/**
 * Pairs a recommended example with the mistake it replaces. Put one `Do` and
 * one `Dont` inside, in that order.
 */
export function DoDont({children}: DoDontProps) {
  return (
    <Grid
      columns={{zero: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}}
      gap="xl"
      marginTop="md"
    >
      {children}
    </Grid>
  );
}

interface GuidelineProps {
  /** One sentence saying what to do or avoid, and why. */
  caption: React.ReactNode;
  children: React.ReactNode;
}

export function Do(props: GuidelineProps) {
  return <Guideline {...props} kind="do" />;
}

export function Dont(props: GuidelineProps) {
  return <Guideline {...props} kind="dont" />;
}

function Guideline({caption, children, kind}: GuidelineProps & {kind: 'do' | 'dont'}) {
  const variant = kind === 'do' ? 'success' : 'danger';
  return (
    <Stack as="figure" margin="0" gap="md" minWidth="0">
      <Flex
        flex="1"
        align="center"
        justify="center"
        gap="md"
        padding="3xl xl"
        minHeight="120px"
        background="secondary"
        border={variant}
        radius="md"
      >
        {children}
      </Flex>
      <Stack gap="xs">
        {props => (
          <figcaption {...props}>
            <Flex align="center" gap="xs">
              {kind === 'do' ? (
                <IconCheckmark size="xs" variant={variant} />
              ) : (
                <IconClose size="xs" variant={variant} />
              )}
              <Text bold variant={variant}>
                {kind === 'do' ? t('Do') : t("Don't")}
              </Text>
            </Flex>
            <Text variant="muted">{caption}</Text>
          </figcaption>
        )}
      </Stack>
    </Stack>
  );
}
