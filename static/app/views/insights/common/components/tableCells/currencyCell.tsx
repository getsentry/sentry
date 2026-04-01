import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatDollars} from 'sentry/utils/formatters';

type Props = {
  value: number | null;
};

const NEGATIVE_COST_DOCS_URL =
  'https://docs.sentry.io/ai/monitoring/agents/costs/#troubleshooting';

export function NegativeCostWarning({children}: {children: React.ReactNode}) {
  return (
    <Tooltip
      title={tct(
        'Negative costs indicate an error in token count reporting. [link:Follow this guide] to troubleshoot.',
        {
          link: <ExternalLink href={NEGATIVE_COST_DOCS_URL} />,
        }
      )}
      skipWrapper
    >
      <Flex as="span" display="inline-flex" align="center" gap="xs">
        <IconWarning legacySize="1em" variant="warning" />
        {children}
      </Flex>
    </Tooltip>
  );
}

export function CurrencyCell({value}: Props) {
  if (value === null || value === undefined) {
    return <NumberContainer>{'\u2014'}</NumberContainer>;
  }

  if (value < 0) {
    return (
      <NumberContainer>
        <NegativeCostWarning>{formatDollars(value)}</NegativeCostWarning>
      </NumberContainer>
    );
  }

  if (value > 0 && value < 0.01) {
    return <NumberContainer>{`<$${(0.01).toLocaleString()}`}</NumberContainer>;
  }

  return <NumberContainer>{formatDollars(value)}</NumberContainer>;
}
