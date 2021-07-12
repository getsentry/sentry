import {ComponentProps, useState} from 'react';
import styled from '@emotion/styled';

import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import {Panel} from 'app/components/panels';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = ComponentProps<typeof TimeRangeSelector> & {
  className?: string;
};

function PageTimeRangeSelector({className, ...props}: Props) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <DropdownDate className={className} isCalendarOpen={isCalendarOpen}>
      <TimeRangeSelector
        key={`period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`}
        label={<DropdownLabel>{t('Date Range:')}</DropdownLabel>}
        onToggleSelector={isOpen => setIsCalendarOpen(isOpen)}
        relativeOptions={DEFAULT_RELATIVE_PERIODS}
        {...props}
      />
    </DropdownDate>
  );
}

const DropdownDate = styled(Panel)<{isCalendarOpen: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 42px;

  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p =>
    p.isCalendarOpen
      ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
      : p.theme.borderRadius};
  padding: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};

  /* TimeRangeRoot in TimeRangeSelector */
  > div {
    width: 100%;
    align-self: stretch;
  }

  /* StyledItemHeader used to show selected value of TimeRangeSelector */
  > div > div:first-child {
    padding: 0 ${space(2)};
  }

  /* Menu that dropdowns from TimeRangeSelector */
  > div > div:last-child {
    /* Remove awkward 1px width difference on dropdown due to border */
    box-sizing: content-box;
    font-size: 1em;
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
