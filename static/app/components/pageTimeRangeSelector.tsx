import styled from '@emotion/styled';

import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {t} from 'sentry/locale';

type PageTimeRangeSelectorProps = React.ComponentProps<typeof TimeRangeSelector>;

function PageTimeRangeSelector(props: PageTimeRangeSelectorProps) {
  return (
    <StyledTimeRangeSelector
      key={`period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`}
      triggerProps={{icon: null, prefix: t('Date Range')}}
      // Use relative option labels (e.g. "Last 7 days") not keys ("7D")
      triggerLabel={
        props.relativeOptions && props.relative
          ? props.relativeOptions[props.relative]
          : null
      }
      {...props}
    />
  );
}

const StyledTimeRangeSelector = styled(TimeRangeSelector)`
  width: 100%;

  button[aria-haspopup='listbox'] {
    width: 100%;
  }
`;

export default PageTimeRangeSelector;
