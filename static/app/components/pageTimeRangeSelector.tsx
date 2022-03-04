import styled from '@emotion/styled';

import TimeRangeSelector from 'sentry/components/organizations/timeRangeSelector';
import {Panel} from 'sentry/components/panels';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

type Props = React.ComponentProps<typeof TimeRangeSelector> & {
  className?: string;
};

function PageTimeRangeSelector({className, ...props}: Props) {
  return (
    <DropdownDate className={className}>
      <TimeRangeSelector
        key={`period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`}
        label={<DropdownLabel>{t('Date Range:')}</DropdownLabel>}
        relativeOptions={DEFAULT_RELATIVE_PERIODS}
        {...props}
      />
    </DropdownDate>
  );
}

const DropdownDate = styled(Panel)`
  padding: 0;
  margin: 0;
`;

const DropdownLabel = styled('span')`
  text-align: left;
  font-weight: 600;
  color: ${p => p.theme.textColor};

  > span:last-child {
    font-weight: 400;
  }
`;

export default PageTimeRangeSelector;
