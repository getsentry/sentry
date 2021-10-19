import * as React from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

type Props = {
  title: string;
  newestFirst: boolean;
  onChange?: ({newestFirst}: {newestFirst: boolean}) => void;
  hideGuide?: boolean;
};

function CrashTitle({title, newestFirst, hideGuide = false, onChange}: Props) {
  function handleToggleOrder() {
    onChange?.({newestFirst: !newestFirst});
  }

  return (
    <StyledH3>
      <GuideAnchor target="exception" disabled={hideGuide} position="bottom">
        {title}
      </GuideAnchor>
      {onChange && (
        <Tooltip title={t('Toggle stack trace order')}>
          <small>
            (
            <span onClick={handleToggleOrder}>
              {newestFirst ? t('most recent call first') : t('most recent call last')}
            </span>
            )
          </small>
        </Tooltip>
      )}
    </StyledH3>
  );
}

export default CrashTitle;

const StyledH3 = styled('h3')`
  margin-bottom: 0;
  max-width: 100%;
  white-space: nowrap;
`;
