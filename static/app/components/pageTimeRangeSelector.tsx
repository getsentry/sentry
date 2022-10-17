import styled from '@emotion/styled';

import TimeRangeSelector from 'sentry/components/organizations/timeRangeSelector';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = React.ComponentProps<typeof TimeRangeSelector> & {className?: string};

function PageTimeRangeSelector({className, ...props}: Props) {
  return (
    <DropdownDate className={className}>
      <TimeRangeSelector
        key={`period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`}
        label={<DropdownLabel>{t('Date Range:')}</DropdownLabel>}
        detached
        {...props}
      />
    </DropdownDate>
  );
}

const DropdownDate = styled(Panel)`
  padding: 0;
  margin: 0;

  display: flex;
  justify-content: center;
  align-items: center;
  height: ${p => p.theme.form.md.height}px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};

  > div {
    width: 100%;
    align-self: stretch;
  }
  /* StyledItemHeader used to show selected value of TimeRangeSelector */
  > div > div:first-child > div {
    padding: 0 ${space(2)};
  }
  /* Menu that dropdowns from TimeRangeSelector */
  > div > div:last-child:not(:first-child) {
    /* Remove awkward 1px width difference on dropdown due to border */
    min-width: calc(100% + 2px);
    transform: translateX(-1px);
    right: auto;
  }
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
