import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';

type Props = {
  newestFirst: boolean;
  title: string;
  beforeTitle?: React.ReactNode;
  hideGuide?: boolean;
  onChange?: ({newestFirst}: {newestFirst: boolean}) => void;
};

const CrashTitle = ({
  title,
  newestFirst,
  beforeTitle,
  hideGuide = false,
  onChange,
}: Props) => {
  const handleToggleOrder = () => {
    if (onChange) {
      onChange({newestFirst: !newestFirst});
    }
  };

  return (
    <Wrapper>
      {beforeTitle}
      <StyledH3>
        <GuideAnchor target="exception" disabled={hideGuide} position="bottom">
          {title}
        </GuideAnchor>
        {onChange && (
          <Tooltip showUnderline title={t('Toggle stack trace order')}>
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
    </Wrapper>
  );
};

export default CrashTitle;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  flex-grow: 1;
  justify-content: flex-start;
`;

const StyledH3 = styled('h3')`
  margin-bottom: 0;
  max-width: 100%;
  white-space: nowrap;
`;
