import {MouseEvent} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'sentry/components/stacktracePreview';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PlatformType} from 'sentry/types';

import {isDotnet} from '../utils';

type Props = {
  isExpandable: boolean;
  platform: PlatformType;
  onToggleContext: (evt: MouseEvent) => void;
  isHoverPreviewed?: boolean;
  isExpanded?: boolean;
};

function Expander({
  isExpandable,
  isHoverPreviewed,
  isExpanded,
  platform,
  onToggleContext,
}: Props) {
  if (!isExpandable) {
    return null;
  }

  return (
    <StyledButton
      className="btn-toggle"
      css={isDotnet(platform) && {display: 'block !important'}} // remove important once we get rid of css files
      title={t('Toggle Context')}
      tooltipProps={
        isHoverPreviewed ? {delay: STACKTRACE_PREVIEW_TOOLTIP_DELAY} : undefined
      }
      onClick={onToggleContext}
    >
      <IconChevron direction={isExpanded ? 'up' : 'down'} size="8px" />
    </StyledButton>
  );
}

export default Expander;

// the Button's label has the padding of 3px because the button size has to be 16x16 px.
const StyledButton = styled(Button)`
  margin-left: ${space(1)};
  span:first-child {
    padding: 3px;
  }
`;
