import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatDollars} from 'sentry/utils/formatters';

type Props = {
  value: number | null;
};

const NEGATIVE_COST_DOCS_URL = 'https://docs.sentry.io/ai/monitoring/agents/costs/';

export function CurrencyCell({value}: Props) {
  if (value === null || value === undefined) {
    return <NumberContainer>{'\u2014'}</NumberContainer>;
  }

  if (value < 0) {
    return (
      <NumberContainer>
        <Tooltip
          title={tct(
            'Negative costs can occur when cached token pricing differs from standard token pricing. [link:Learn more].',
            {
              link: <ExternalLink href={NEGATIVE_COST_DOCS_URL} />,
            }
          )}
          skipWrapper
        >
          <NegativeCostWrapper>
            <IconWarning size="sm" variant="warning" />
            {formatDollars(value)}
          </NegativeCostWrapper>
        </Tooltip>
      </NumberContainer>
    );
  }

  if (value > 0 && value < 0.01) {
    return <NumberContainer>{`<$${(0.01).toLocaleString()}`}</NumberContainer>;
  }

  return <NumberContainer>{formatDollars(value)}</NumberContainer>;
}

const NegativeCostWrapper = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;
