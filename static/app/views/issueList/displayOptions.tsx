import {Fragment} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import FeatureBadge from 'sentry/components/featureBadge';
import Tooltip from 'sentry/components/tooltip';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import {getDisplayLabel, IssueDisplayOptions} from 'sentry/views/issueList/utils';

type Props = {
  display: IssueDisplayOptions;
  hasMultipleProjectsSelected: boolean;
  hasSessions: boolean;
  onDisplayChange: (display: string) => void;
  hasPageFilters?: boolean;
};

const IssueListDisplayOptions = ({
  onDisplayChange,
  display,
  hasSessions,
  hasMultipleProjectsSelected,
  hasPageFilters,
}: Props) => {
  const getMenuItem = (key: IssueDisplayOptions): React.ReactNode => {
    let tooltipText: string | undefined;
    let disabled = false;
    if (key === IssueDisplayOptions.SESSIONS) {
      if (hasMultipleProjectsSelected) {
        tooltipText = t(
          'This option is not available when multiple projects are selected.'
        );
        disabled = true;
      } else if (!hasSessions) {
        tooltipText = t(
          'This option is not available because there is no session data in the selected time period.'
        );
        disabled = true;
      }
    }

    return (
      <DropdownItem
        onSelect={onDisplayChange}
        eventKey={key}
        isActive={key === display}
        disabled={disabled}
      >
        <StyledTooltip
          containerDisplayMode="block"
          position="top"
          title={tooltipText}
          disabled={!tooltipText}
        >
          <OptionWrap>
            {getDisplayLabel(key)}
            {key === IssueDisplayOptions.SESSIONS && (
              <FeatureBadge type="beta" noTooltip />
            )}
          </OptionWrap>
        </StyledTooltip>
      </DropdownItem>
    );
  };

  return (
    <GuideAnchor
      target="percentage_based_alerts"
      position="bottom"
      disabled={!hasSessions || hasMultipleProjectsSelected}
    >
      <StyledDropdownControl
        buttonProps={
          hasPageFilters
            ? {
                borderless: true,
                size: 'small',
                icon: <IconStack />,
              }
            : {prefix: t('Display')}
        }
        detached={hasPageFilters}
        buttonTooltipTitle={
          display === IssueDisplayOptions.SESSIONS
            ? t(
                'This shows the event count as a percent of sessions in the same time period.'
              )
            : null
        }
        label={
          !hasSessions || hasMultipleProjectsSelected
            ? getDisplayLabel(IssueDisplayOptions.EVENTS)
            : getDisplayLabel(display)
        }
      >
        <Fragment>
          {getMenuItem(IssueDisplayOptions.EVENTS)}
          {getMenuItem(IssueDisplayOptions.SESSIONS)}
        </Fragment>
      </StyledDropdownControl>
    </GuideAnchor>
  );
};

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;

const OptionWrap = styled('span')`
  white-space: nowrap;
`;

const StyledDropdownControl = styled(DropdownControl)`
  z-index: ${p => p.theme.zIndex.issuesList.displayOptions};

  button {
    width: 100%;
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 1;
  }
`;

export default IssueListDisplayOptions;
