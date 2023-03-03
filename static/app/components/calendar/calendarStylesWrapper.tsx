import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const CalendarStylesWrapper = styled('div')`
  padding: ${space(3)};

  .rdrCalendarWrapper:not(.rdrDateRangeWrapper) .rdrDayHovered .rdrDayNumber:after {
    border: 0;
  }

  .rdrSelected,
  .rdrInRange,
  .rdrStartEdge,
  .rdrEndEdge {
    background-color: ${p => p.theme.active};
  }

  .rdrStartEdge + .rdrDayStartPreview {
    background-color: transparent;
  }

  .rdrDayNumber span {
    color: ${p => p.theme.textColor};
  }

  .rdrDayDisabled {
    background: none;
  }

  .rdrDayDisabled span {
    color: ${p => p.theme.subText};
  }

  .rdrDayToday .rdrDayNumber span {
    color: ${p => p.theme.active};
  }

  .rdrDayNumber span:after {
    background-color: ${p => p.theme.active};
  }

  .rdrDefinedRangesWrapper,
  .rdrDateDisplayWrapper,
  .rdrWeekDays {
    display: none;
  }

  .rdrInRange {
    background: ${p => p.theme.active};
  }

  .rdrDayInPreview {
    background: ${p => p.theme.hover};
  }

  .rdrMonth {
    width: 300px;
    font-size: 1.2em;
    padding: 0;
  }

  .rdrStartEdge {
    border-top-left-radius: 1.14em;
    border-bottom-left-radius: 1.14em;
  }

  .rdrEndEdge {
    border-top-right-radius: 1.14em;
    border-bottom-right-radius: 1.14em;
  }

  .rdrDayStartPreview,
  .rdrDayEndPreview,
  .rdrDayInPreview {
    border: 0;
    background: rgba(200, 200, 200, 0.3);
  }

  .rdrDayStartOfMonth,
  .rdrDayStartOfWeek {
    .rdrInRange {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  .rdrDayEndOfMonth,
  .rdrDayEndOfWeek {
    .rdrInRange {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  }

  .rdrStartEdge.rdrEndEdge {
    border-radius: 1.14em;
  }

  .rdrMonthAndYearWrapper {
    padding-bottom: ${space(1)};
    padding-top: 0;
    height: 32px;
  }

  .rdrDay {
    height: 2.5em;
  }

  .rdrMonthPicker select,
  .rdrYearPicker select {
    background: none;
    color: ${p => p.theme.textColor};
    font-weight: normal;
    font-size: ${p => p.theme.fontSizeLarge};
    padding: 0;
  }

  .rdrMonthsVertical {
    align-items: center;
  }

  .rdrCalendarWrapper {
    flex: 1;
    background: none;
  }

  .rdrNextPrevButton {
    background-color: transparent;
    border: 1px solid ${p => p.theme.border};
  }

  .rdrPprevButton i {
    border-right-color: ${p => p.theme.textColor};
  }

  .rdrNextButton i {
    border-left-color: ${p => p.theme.textColor};
  }
`;

export default CalendarStylesWrapper;
