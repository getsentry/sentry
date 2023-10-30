import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const CalendarStylesWrapper = styled('div')`
  padding: ${space(2)};

  .rdrCalendarWrapper:not(.rdrDateRangeWrapper) .rdrDayHovered .rdrDayNumber:after {
    border: 0;
  }

  .rdrSelected,
  .rdrInRange,
  .rdrStartEdge,
  .rdrEndEdge {
    left: 0;
    right: 0;
    top: 3px;
    bottom: 3px;
    background-color: ${p => p.theme.active};
  }

  .rdrDayNumber {
    top: 3px;
    bottom: 3px;
    font-weight: normal;
  }

  .rdrDayNumber span {
    color: ${p => p.theme.textColor};
  }

  .rdrDay:not(.rdrDayPassive) .rdrStartEdge ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrEndEdge ~ .rdrDayNumber span,
  .rdrDay:not(.rdrDayPassive) .rdrInRange ~ .rdrDayNumber span {
    color: ${p => p.theme.white};
  }

  .rdrDayDisabled {
    background: none;
  }

  .rdrDayDisabled .rdrDayNumber span,
  .rdrDayPassive .rdrDayNumber span {
    color: ${p => p.theme.subText};
    opacity: 0.5;
  }

  .rdrDayToday .rdrDayNumber span {
    color: ${p => p.theme.activeText};

    &:after {
      display: none;
    }
  }

  .rdrDayToday .rdrDayNumber {
    border-radius: 2rem;
    box-shadow: inset 0 0 0 2px ${p => p.theme.active};
  }

  .rdrDayNumber span:after {
    background-color: ${p => p.theme.active};
    font-variant-numeric: tabular-nums;
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
    background: ${p => p.theme.headingColor};
    opacity: 0.08;
    z-index: -1;
  }

  .rdrDayStartOfMonth {
    .rdrInRange,
    .rdrDayInPreview {
      border-top-left-radius: ${p => p.theme.borderRadius};
      border-bottom-left-radius: ${p => p.theme.borderRadius};
    }
  }

  .rdrDayStartOfWeek {
    .rdrInRange,
    .rdrEndEdge,
    .rdrDayInPreview,
    /* Adjust radii on last hovered day, unless it's also the start of a selected range */
    .rdrDayEndPreview:not(.rdrDayStartPreview):first-child,
    :not(.rdrStartEdge) ~ .rdrDayEndPreview:not(.rdrDayStartPreview) {
      border-top-left-radius: ${p => p.theme.borderRadius};
      border-bottom-left-radius: ${p => p.theme.borderRadius};
    }
  }

  .rdrDayEndOfMonth {
    .rdrInRange,
    .rdrDayInPreview {
      border-top-right-radius: ${p => p.theme.borderRadius};
      border-bottom-right-radius: ${p => p.theme.borderRadius};
    }
  }

  .rdrDayEndOfWeek {
    .rdrInRange,
    .rdrStartEdge,
    .rdrDayInPreview,
    /* Adjust radii on first hovered day, unless it's also the end of a selected range */
    .rdrDayStartPreview:not(.rdrDayEndPreview):first-child,
    :not(.rdrEndEdge) ~ .rdrDayStartPreview:not(.rdrDayEndPreview) {
      border-top-right-radius: ${p => p.theme.borderRadius};
      border-bottom-right-radius: ${p => p.theme.borderRadius};
    }
  }

  .rdrDayStartOfMonth,
  .rdrDayStartOfWeek {
    .rdrInRange,
    .rdrEndEdge {
      left: 0;
    }
  }

  .rdrDayEndOfMonth,
  .rdrDayEndOfWeek {
    .rdrInRange,
    .rdrStartEdge {
      right: 0;
    }
  }

  .rdrStartEdge.rdrEndEdge {
    border-radius: 1.14em;
  }

  .rdrMonthAndYearWrapper {
    height: 32px;
    align-items: stretch;
    padding-bottom: ${space(1)};
    padding-top: 0;
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
    padding: ${space(0.25)} ${space(1)};
  }

  .rdrMonthsVertical {
    align-items: center;
  }

  .rdrCalendarWrapper {
    flex: 1;
    background: none;
  }

  .rdrNextPrevButton {
    width: 44px;
    display: flex;
    justify-content: center;
    align-items: center;
    height: auto;
    background-color: transparent;
    border: none;
  }

  .rdrNextPrevButton:hover,
  .rdrMonthPicker:hover,
  .rdrYearPicker:hover {
    position: relative;
    background-color: transparent;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: ${p => p.theme.borderRadius};
      background: ${p => p.theme.headingColor};
      opacity: 0.08;
      z-index: -1;
    }
  }

  .rdrMonthPicker select:hover,
  .rdrYearPicker select:hover {
    background-color: transparent;
  }

  .rdrPprevButton {
    margin-left: 0;
  }

  .rdrNextButton {
    margin-right: 0;
  }

  .rdrPprevButton i {
    border-right-color: ${p => p.theme.textColor};
    margin: 0;
  }

  .rdrNextButton i {
    border-left-color: ${p => p.theme.textColor};
    margin: 0;
  }
`;

export default CalendarStylesWrapper;
