import {useState} from 'react';
import styled from '@emotion/styled';

import TimeRangeSelector from 'sentry/components/organizations/timeRangeSelector';
import {Panel} from 'sentry/components/panels';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type Props = React.ComponentProps<typeof TimeRangeSelector> & {
  className?: string;
};

function PageTimeRangeSelector({className, customDropdownButton, ...props}: Props) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <DropdownDate
      className={className}
      isCalendarOpen={isCalendarOpen}
      hasCustomButton={defined(customDropdownButton)}
    >
      <TimeRangeSelector
        key={`period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`}
        label={<DropdownLabel>{t('Date Range:')}</DropdownLabel>}
        onToggleSelector={isOpen => setIsCalendarOpen(isOpen)}
        relativeOptions={DEFAULT_RELATIVE_PERIODS}
        customDropdownButton={customDropdownButton}
        detached
        {...props}
      />
    </DropdownDate>
  );
}

const DropdownDate = styled(Panel)<{hasCustomButton: boolean; isCalendarOpen: boolean}>`
  padding: 0;
  margin: 0;

  ${p =>
    !p.hasCustomButton &&
    `
    display: flex;
    justify-content: center;
    align-items: center;
    height: 42px;
    background: ${p.theme.background};
    border: 1px solid ${p.theme.border};
    border-radius: ${
      p.isCalendarOpen
        ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
        : p.theme.borderRadius
    };

    font-size: ${p.theme.fontSizeMedium};
    color: ${p.theme.textColor};

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
      width: calc(100% + 2px);
      transform: translateX(-1px);
      right: auto;
    }
  `}
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
